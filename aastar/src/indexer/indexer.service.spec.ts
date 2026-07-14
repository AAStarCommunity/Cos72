import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { BadRequestException } from "@nestjs/common";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { IndexerService } from "./indexer.service";
import { IndexerController } from "./indexer.controller";
import {
  INDEXER_PERSISTENCE,
  IndexerPersistence,
  IndexerPersistenceError,
} from "./persistence/indexer-persistence.interface";
import { IndexerJsonAdapter } from "./persistence/indexer-json.adapter";
import { IndexedEventRecord, IndexerSourceConfig, IndexerSourceState } from "./indexer.types";

// Mock viem to avoid real blockchain calls (style: registry.service.spec.ts)
const mockPublicClient = {
  getBlockNumber: jest.fn(),
  getBlock: jest.fn(),
  getLogs: jest.fn(),
};

jest.mock("viem", () => ({
  createPublicClient: jest.fn(() => mockPublicClient),
  http: jest.fn(),
}));

/** In-memory IndexerPersistence double. */
class FakePersistence implements IndexerPersistence {
  events = new Map<string, IndexedEventRecord>();
  states = new Map<string, IndexerSourceState>();
  saveEventCalls = 0;
  saveStateCalls = 0;
  deleteCalls: Array<{ source: string; fromBlock: number }> = [];

  async getEvents(filter: { source?: string; limit: number; offset?: number }) {
    const all = [...this.events.values()]
      .filter(e => (filter.source ? e.source === filter.source : true))
      .sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
    const offset = filter.offset ?? 0;
    return all.slice(offset, offset + filter.limit);
  }

  async countEvents(source?: string) {
    return [...this.events.values()].filter(e => (source ? e.source === source : true)).length;
  }

  async hasEvent(id: string) {
    return this.events.has(id);
  }

  async saveEvent(event: IndexedEventRecord) {
    this.saveEventCalls += 1;
    this.events.set(event.id, event);
  }

  async deleteEventsFromBlock(source: string, fromBlock: number) {
    this.deleteCalls.push({ source, fromBlock });
    let deleted = 0;
    for (const [id, e] of this.events.entries()) {
      if (e.source === source && e.blockNumber >= fromBlock) {
        this.events.delete(id);
        deleted += 1;
      }
    }
    return deleted;
  }

  async getState(source: string) {
    return this.states.get(source) ?? null;
  }

  async saveState(state: IndexerSourceState) {
    this.saveStateCalls += 1;
    this.states.set(state.source, JSON.parse(JSON.stringify(state)));
  }

  async runInTransaction<T>(fn: (tx: IndexerPersistence) => Promise<T>): Promise<T> {
    return fn(this);
  }
}

const TEST_ABI = [
  {
    type: "event",
    name: "Purchased",
    inputs: [
      { name: "buyer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as any;

const SOURCE: IndexerSourceConfig = {
  key: "myshop-purchases",
  address: "0x1111111111111111111111111111111111111111",
  abi: TEST_ABI,
  events: ["Purchased"],
  fromBlock: 100,
};

function makeLog(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    eventName: "Purchased",
    args: { buyer: "0xbuyer", amount: 5n },
    blockNumber: 100n,
    blockHash: "0xhash100",
    transactionHash: "0xtxA",
    logIndex: 0n,
    ...overrides,
  };
}

/** Chain fixture: getBlockNumber / getBlock(hash per height) / getLogs. */
function mockChain(tip: number, hashes: Record<number, string>, logs: unknown[]) {
  mockPublicClient.getBlockNumber.mockResolvedValue(BigInt(tip));
  mockPublicClient.getBlock.mockImplementation(
    async ({ blockNumber }: { blockNumber: bigint }) => ({
      hash: hashes[Number(blockNumber)] ?? `0xhash${blockNumber}`,
    })
  );
  mockPublicClient.getLogs.mockResolvedValue(logs);
}

const DEFAULT_CFG: Record<string, string> = {
  ethRpcUrl: "http://localhost:8545",
  INDEXER_POLL_MS: "12000",
  INDEXER_LOOKBACK_BLOCKS: "12",
};

async function buildService(
  persistence: IndexerPersistence,
  cfg: Record<string, string> = {}
): Promise<IndexerService> {
  const merged = { ...DEFAULT_CFG, ...cfg };
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      IndexerService,
      { provide: INDEXER_PERSISTENCE, useValue: persistence },
      {
        provide: ConfigService,
        useValue: { get: jest.fn().mockImplementation((key: string) => merged[key]) },
      },
    ],
  }).compile();
  return module.get<IndexerService>(IndexerService);
}

describe("IndexerService", () => {
  let service: IndexerService;
  let persistence: FakePersistence;

  beforeEach(async () => {
    jest.clearAllMocks();
    persistence = new FakePersistence();
    service = await buildService(persistence);
    service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("configuration validation (fail fast)", () => {
    it("throws on non-numeric INDEXER_POLL_MS", async () => {
      const svc = await buildService(new FakePersistence(), { INDEXER_POLL_MS: "abc" });
      expect(() => svc.onModuleInit()).toThrow(/INDEXER_POLL_MS/);
    });

    it("throws on zero/negative/out-of-range values", async () => {
      const zero = await buildService(new FakePersistence(), { INDEXER_POLL_MS: "0" });
      expect(() => zero.onModuleInit()).toThrow(/INDEXER_POLL_MS/);

      const negative = await buildService(new FakePersistence(), {
        INDEXER_LOOKBACK_BLOCKS: "-5",
      });
      expect(() => negative.onModuleInit()).toThrow(/INDEXER_LOOKBACK_BLOCKS/);

      const window = await buildService(new FakePersistence(), { INDEXER_SCAN_WINDOW: "1.5" });
      expect(() => window.onModuleInit()).toThrow(/INDEXER_SCAN_WINDOW/);
    });
  });

  describe("lifecycle", () => {
    it("onModuleInit is idempotent (no second interval leaked)", () => {
      const timerBefore = (service as any).timer;
      service.onModuleInit(); // second call must be a no-op
      expect((service as any).timer).toBe(timerBefore);
      expect(service.getMetrics().running).toBe(true);
    });

    it("onModuleDestroy waits for the in-flight poll round", async () => {
      service.registerSource(SOURCE);
      let resolveTip: (value: bigint) => void;
      mockPublicClient.getBlockNumber.mockReturnValue(
        new Promise<bigint>(resolve => (resolveTip = resolve))
      );
      mockPublicClient.getBlock.mockResolvedValue({ hash: "0xhash100" });
      mockPublicClient.getLogs.mockResolvedValue([]);

      const pollPromise = service.pollOnce(); // suspends on getBlockNumber
      let destroyed = false;
      const destroyPromise = service.onModuleDestroy().then(() => {
        destroyed = true;
      });

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(destroyed).toBe(false); // destroy is blocked on the in-flight poll

      resolveTip(100n);
      await pollPromise;
      await destroyPromise;
      expect(destroyed).toBe(true);
    });
  });

  describe("registration", () => {
    it("rejects duplicate source keys", () => {
      service.registerSource(SOURCE);
      expect(() => service.registerSource(SOURCE)).toThrow(/already registered/);
    });

    it("rejects events missing from the ABI", () => {
      expect(() => service.registerSource({ ...SOURCE, events: ["Nope"] })).toThrow(/not in ABI/);
    });

    it("rejects a negative fromBlock", () => {
      expect(() => service.registerSource({ ...SOURCE, fromBlock: -1 })).toThrow(/fromBlock/);
    });
  });

  describe("idle behaviour", () => {
    it("does not hit the RPC when no source is registered", async () => {
      await service.pollOnce();
      expect(mockPublicClient.getBlockNumber).not.toHaveBeenCalled();
      expect(mockPublicClient.getLogs).not.toHaveBeenCalled();
    });

    it("skips overlapping pollOnce calls (in-flight mutual exclusion)", async () => {
      service.registerSource(SOURCE);
      let resolveTip: (value: bigint) => void;
      mockPublicClient.getBlockNumber.mockReturnValue(
        new Promise<bigint>(resolve => (resolveTip = resolve))
      );
      mockPublicClient.getBlock.mockResolvedValue({ hash: "0xhash100" });
      mockPublicClient.getLogs.mockResolvedValue([]);

      const first = service.pollOnce();
      const second = service.pollOnce(); // must return immediately, no second RPC round
      await second;
      expect(mockPublicClient.getBlockNumber).toHaveBeenCalledTimes(1);

      resolveTip!(100n);
      await first;
      expect(mockPublicClient.getBlockNumber).toHaveBeenCalledTimes(1);
      expect(service.getMetrics().totalPolls).toBe(1);
    });
  });

  describe("dedup", () => {
    it("skips logs already stored under txHash:logIndex on rescan", async () => {
      service.registerSource(SOURCE);
      mockChain(100, { 100: "0xhash100" }, [makeLog()]);

      await service.pollOnce();
      await service.pollOnce(); // same tip, same log returned again

      expect(persistence.events.size).toBe(1);
      expect(persistence.saveEventCalls).toBe(1);
      expect(persistence.events.has("0xtxA:0")).toBe(true);
    });

    it("serializes bigint args to JSON-safe strings", async () => {
      service.registerSource(SOURCE);
      mockChain(100, { 100: "0xhash100" }, [makeLog()]);

      await service.pollOnce();

      const event = persistence.events.get("0xtxA:0");
      expect(event.args).toEqual({ buyer: "0xbuyer", amount: "5" });
      expect(() => JSON.stringify(event)).not.toThrow();
    });
  });

  describe("lookback replay", () => {
    it("rescans from lastProcessedBlock - LOOKBACK and stays idempotent", async () => {
      service.registerSource({ ...SOURCE, fromBlock: 50 });
      mockChain(100, { 100: "0xhash100" }, [makeLog()]);
      await service.pollOnce();
      expect(mockPublicClient.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({ fromBlock: 50n, toBlock: 100n })
      );

      // Next round: tip advances to 105; old log is replayed plus one new log.
      const newLog = makeLog({
        blockNumber: 103n,
        blockHash: "0xhash103",
        transactionHash: "0xtxB",
        logIndex: 1n,
      });
      mockChain(105, { 100: "0xhash100", 103: "0xhash103", 105: "0xhash105" }, [makeLog(), newLog]);
      await service.pollOnce();

      // lookback window: 100 (lastProcessed) - 12 = 88
      expect(mockPublicClient.getLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ fromBlock: 88n, toBlock: 105n })
      );
      expect(persistence.events.size).toBe(2); // replayed log deduped, new log added
      expect(persistence.saveEventCalls).toBe(2);
      expect(persistence.states.get("myshop-purchases").lastProcessedBlock).toBe(105);
    });

    it("never scans below the registered fromBlock", async () => {
      service.registerSource(SOURCE); // fromBlock 100
      mockChain(101, { 101: "0xhash101" }, []);
      await service.pollOnce();
      expect(mockPublicClient.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({ fromBlock: 100n, toBlock: 101n })
      );
    });
  });

  describe("chunked scanning", () => {
    it("splits a long range into INDEXER_SCAN_WINDOW chunks and advances state per chunk", async () => {
      await service.onModuleDestroy();
      service = await buildService(persistence, { INDEXER_SCAN_WINDOW: "10" });
      service.onModuleInit();
      service.registerSource(SOURCE); // fromBlock 100
      mockChain(130, { 130: "0xhash130" }, []);

      await service.pollOnce();

      const ranges = mockPublicClient.getLogs.mock.calls.map(call => [
        call[0].fromBlock,
        call[0].toBlock,
      ]);
      expect(ranges).toEqual([
        [100n, 109n],
        [110n, 119n],
        [120n, 129n],
        [130n, 130n],
      ]);
      expect(persistence.saveStateCalls).toBe(4); // cursor committed per chunk
      expect(persistence.states.get("myshop-purchases").lastProcessedBlock).toBe(130);
    });

    it("shrinks the window and retries when getLogs rejects a range", async () => {
      await service.onModuleDestroy();
      service = await buildService(persistence, { INDEXER_SCAN_WINDOW: "10" });
      service.onModuleInit();
      service.registerSource(SOURCE);
      mockPublicClient.getBlockNumber.mockResolvedValue(109n);
      mockPublicClient.getBlock.mockResolvedValue({ hash: "0xhash109" });
      mockPublicClient.getLogs.mockImplementation(
        async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
          if (fromBlock === 100n && toBlock === 109n) throw new Error("query range too large");
          return [];
        }
      );

      await service.pollOnce();

      const ranges = mockPublicClient.getLogs.mock.calls.map(call => [
        call[0].fromBlock,
        call[0].toBlock,
      ]);
      // Full range fails, halves succeed.
      expect(ranges).toEqual([
        [100n, 109n],
        [100n, 104n],
        [105n, 109n],
      ]);
      expect(persistence.states.get("myshop-purchases").lastProcessedBlock).toBe(109);
      expect(service.getMetrics().currentError).toBeNull(); // round still succeeded
    });
  });

  describe("reorg rollback", () => {
    it("deletes events at/after a height whose blockHash changed, then rescans", async () => {
      service.registerSource(SOURCE);
      mockChain(100, { 100: "0xhash100" }, [makeLog()]);
      await service.pollOnce();
      expect(persistence.events.has("0xtxA:0")).toBe(true);

      // Reorg: height 100 now has a different hash and a replacement log.
      const replacementLog = makeLog({
        blockHash: "0xhash100-reorged",
        transactionHash: "0xtxA-reorged",
      });
      mockChain(101, { 100: "0xhash100-reorged", 101: "0xhash101" }, [replacementLog]);
      await service.pollOnce();

      expect(persistence.deleteCalls).toEqual([{ source: "myshop-purchases", fromBlock: 100 }]);
      expect(persistence.events.has("0xtxA:0")).toBe(false); // dropped fork record gone
      expect(persistence.events.has("0xtxA-reorged:0")).toBe(true); // canonical record indexed
      const state = persistence.states.get("myshop-purchases");
      expect(state.lastProcessedBlock).toBe(101);
      expect(state.blockHashes["100"]).toBe("0xhash100-reorged");
      expect(service.getMetrics().reorgCount).toBe(1);
    });

    it("runs the reorg delete + rescan writes + state upsert inside one transaction", async () => {
      service.registerSource(SOURCE);
      mockChain(100, { 100: "0xhash100" }, [makeLog()]);
      await service.pollOnce();

      const txSpy = jest.spyOn(persistence, "runInTransaction");
      mockChain(101, { 100: "0xhash100-reorged", 101: "0xhash101" }, [
        makeLog({ blockHash: "0xhash100-reorged", transactionHash: "0xtxA-reorged" }),
      ]);
      await service.pollOnce();

      expect(txSpy).toHaveBeenCalledTimes(1); // one chunk => delete+writes+state in one tx
    });

    it("does not roll back when recorded hashes still match", async () => {
      service.registerSource(SOURCE);
      mockChain(100, { 100: "0xhash100" }, [makeLog()]);
      await service.pollOnce();

      mockChain(101, { 100: "0xhash100", 101: "0xhash101" }, [makeLog()]);
      await service.pollOnce();

      expect(persistence.deleteCalls).toHaveLength(0);
      expect(persistence.events.size).toBe(1);
    });
  });

  describe("error handling", () => {
    it("disables a source on persistence corruption instead of retrying", async () => {
      service.registerSource(SOURCE);
      jest
        .spyOn(persistence, "getState")
        .mockRejectedValue(new IndexerPersistenceError("indexed_events.json corrupted"));
      mockChain(100, { 100: "0xhash100" }, [makeLog()]);

      await service.pollOnce();

      const metrics = service.getMetrics();
      expect(metrics.sources["myshop-purchases"].status).toBe("disabled");
      expect(metrics.lastError).toContain("corrupted");
      expect(persistence.saveEventCalls).toBe(0); // nothing written over the corrupt store

      // Disabled source no longer drives RPC traffic.
      mockPublicClient.getBlockNumber.mockClear();
      await service.pollOnce();
      expect(mockPublicClient.getBlockNumber).not.toHaveBeenCalled();
    });

    it("applies exponential backoff to timer ticks after a failed round", async () => {
      service.registerSource(SOURCE);
      mockPublicClient.getBlockNumber.mockRejectedValueOnce(new Error("rpc down"));
      await service.pollOnce();

      const metrics = service.getMetrics();
      expect(metrics.consecutiveErrors).toBe(1);
      expect(metrics.backoffUntil).toBeGreaterThan(Date.now());

      // A timer tick during backoff is skipped entirely.
      mockChain(100, { 100: "0xhash100" }, []);
      mockPublicClient.getBlockNumber.mockClear();
      (service as any).pollTick();
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockPublicClient.getBlockNumber).not.toHaveBeenCalled();
    });

    it("clears currentError and backoff on the next successful round (lastError stays sticky)", async () => {
      service.registerSource(SOURCE);
      mockPublicClient.getBlockNumber.mockRejectedValueOnce(new Error("rpc down"));
      await service.pollOnce();

      let metrics = service.getMetrics();
      expect(metrics.currentError).toContain("rpc down");
      expect(metrics.lastErrorAt).not.toBeNull();
      expect(metrics.reconnectCount).toBe(0);

      mockChain(100, { 100: "0xhash100" }, [makeLog()]);
      await service.pollOnce(); // manual poll bypasses backoff

      metrics = service.getMetrics();
      expect(metrics.reconnectCount).toBe(1); // client recreated after the failed round
      expect(metrics.currentError).toBeNull();
      expect(metrics.consecutiveErrors).toBe(0);
      expect(metrics.backoffUntil).toBeNull();
      expect(metrics.lastError).toContain("rpc down"); // sticky for post-mortem
      expect(metrics.lastSuccessAt).not.toBeNull();
      expect(metrics.sources["myshop-purchases"].lastProcessedBlock).toBe(100);
    });
  });

  describe("metrics", () => {
    it("reports per-source lastProcessedBlock and lagBlocks", async () => {
      service.registerSource(SOURCE);
      mockChain(110, { 110: "0xhash110" }, [
        makeLog({ blockNumber: 110n, blockHash: "0xhash110" }),
      ]);
      await service.pollOnce();

      const metrics = service.getMetrics();
      expect(metrics.sourceCount).toBe(1);
      expect(metrics.latestBlock).toBe(110);
      expect(metrics.lagBlocks).toBe(0);
      expect(metrics.totalPolls).toBe(1);
      expect(metrics.currentError).toBeNull();
      expect(metrics.lastError).toBeNull();
      expect(metrics.sources["myshop-purchases"]).toMatchObject({
        lastProcessedBlock: 110,
        fromBlock: 100,
        eventsIndexed: 1,
        status: "active",
      });
    });
  });

  describe("queryEvents", () => {
    it("clamps limit to 200 and filters by source", async () => {
      service.registerSource(SOURCE);
      mockChain(100, { 100: "0xhash100" }, [makeLog()]);
      await service.pollOnce();

      const result = await service.queryEvents({ source: "myshop-purchases", limit: 5000 });
      expect(result.limit).toBe(200);
      expect(result.total).toBe(1);
      expect(result.events).toHaveLength(1);

      const other = await service.queryEvents({ source: "unknown-source", limit: 0 });
      expect(other.limit).toBe(1); // floor clamp
      expect(other.total).toBe(0);
      expect(other.events).toHaveLength(0);
    });
  });

  describe("IndexerController", () => {
    it("returns 400 for an unknown source", async () => {
      const controller = new IndexerController(service);
      await expect(controller.getEvents("no-such-source")).rejects.toThrow(BadRequestException);
    });

    it("returns 400 for non-integer limit/offset", async () => {
      service.registerSource(SOURCE);
      const controller = new IndexerController(service);
      await expect(controller.getEvents("myshop-purchases", "10abc")).rejects.toThrow(
        BadRequestException
      );
      await expect(controller.getEvents(undefined, "1.5")).rejects.toThrow(BadRequestException);
      await expect(controller.getEvents(undefined, "10", "-1")).rejects.toThrow(
        BadRequestException
      );
    });

    it("passes valid params through to the service", async () => {
      service.registerSource(SOURCE);
      mockChain(100, { 100: "0xhash100" }, [makeLog()]);
      await service.pollOnce();

      const controller = new IndexerController(service);
      const result = await controller.getEvents("myshop-purchases", "10", "0");
      expect(result.limit).toBe(10);
      expect(result.total).toBe(1);
    });
  });
});

describe("IndexerJsonAdapter corruption safety", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "indexer-json-spec-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("throws IndexerPersistenceError on a corrupted file and never overwrites it", async () => {
    const eventsPath = path.join(dir, "indexed_events.json");
    fs.writeFileSync(eventsPath, "{ this is not valid json !!");
    const adapter = new IndexerJsonAdapter(dir);

    await expect(adapter.countEvents()).rejects.toThrow(IndexerPersistenceError);
    await expect(
      adapter.saveEvent({
        id: "0xtx:0",
        source: "s",
        eventName: "E",
        contractAddress: "0x1",
        blockNumber: 1,
        blockHash: "0xh",
        txHash: "0xtx",
        logIndex: 0,
        args: {},
        createdAt: new Date().toISOString(),
      })
    ).rejects.toThrow(IndexerPersistenceError);

    // The corrupted file was NOT silently replaced by the write path.
    expect(fs.readFileSync(eventsPath, "utf-8")).toBe("{ this is not valid json !!");
  });

  it("treats missing files as an empty store (ENOENT only)", async () => {
    const adapter = new IndexerJsonAdapter(dir);
    expect(await adapter.countEvents()).toBe(0);
    expect(await adapter.getState("nope")).toBeNull();
  });

  it("removes leftover .tmp files from a crashed write on startup", () => {
    const tmpPath = path.join(dir, "indexed_events.json.tmp");
    fs.writeFileSync(tmpPath, "partial write");
    new IndexerJsonAdapter(dir);
    expect(fs.existsSync(tmpPath)).toBe(false);
  });

  it("commits runInTransaction writes atomically and visibly", async () => {
    const adapter = new IndexerJsonAdapter(dir);
    await adapter.runInTransaction(async tx => {
      await tx.saveEvent({
        id: "0xtx:0",
        source: "s",
        eventName: "E",
        contractAddress: "0x1",
        blockNumber: 5,
        blockHash: "0xh",
        txHash: "0xtx",
        logIndex: 0,
        args: {},
        createdAt: new Date().toISOString(),
      });
      await tx.saveState({
        source: "s",
        lastProcessedBlock: 5,
        blockHashes: { "5": "0xh" },
        updatedAt: new Date().toISOString(),
      });
    });
    expect(await adapter.countEvents("s")).toBe(1);
    expect((await adapter.getState("s")).lastProcessedBlock).toBe(5);

    // A failing transaction leaves the store untouched.
    await expect(
      adapter.runInTransaction(async tx => {
        await tx.deleteEventsFromBlock("s", 0);
        throw new Error("abort");
      })
    ).rejects.toThrow("abort");
    expect(await adapter.countEvents("s")).toBe(1);
  });
});
