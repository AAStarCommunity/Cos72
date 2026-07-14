import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { IndexerService } from "./indexer.service";
import {
  INDEXER_PERSISTENCE,
  IndexerPersistence,
} from "./persistence/indexer-persistence.interface";
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
    this.states.set(state.source, JSON.parse(JSON.stringify(state)));
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

describe("IndexerService", () => {
  let service: IndexerService;
  let persistence: FakePersistence;

  beforeEach(async () => {
    jest.clearAllMocks();
    persistence = new FakePersistence();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IndexerService,
        { provide: INDEXER_PERSISTENCE, useValue: persistence },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const cfg: Record<string, string> = {
                ethRpcUrl: "http://localhost:8545",
                INDEXER_POLL_MS: "12000",
                INDEXER_LOOKBACK_BLOCKS: "12",
              };
              return cfg[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<IndexerService>(IndexerService);
    service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("registration", () => {
    it("rejects duplicate source keys", () => {
      service.registerSource(SOURCE);
      expect(() => service.registerSource(SOURCE)).toThrow(/already registered/);
    });

    it("rejects events missing from the ABI", () => {
      expect(() => service.registerSource({ ...SOURCE, events: ["Nope"] })).toThrow(/not in ABI/);
    });
  });

  describe("idle behaviour", () => {
    it("does not hit the RPC when no source is registered", async () => {
      await service.pollOnce();
      expect(mockPublicClient.getBlockNumber).not.toHaveBeenCalled();
      expect(mockPublicClient.getLogs).not.toHaveBeenCalled();
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
      expect(metrics.lastError).toBeNull();
      expect(metrics.sources["myshop-purchases"]).toMatchObject({
        lastProcessedBlock: 110,
        fromBlock: 100,
        eventsIndexed: 1,
      });
    });

    it("records lastError on RPC failure and reconnects on the next round", async () => {
      service.registerSource(SOURCE);
      mockPublicClient.getBlockNumber.mockRejectedValueOnce(new Error("rpc down"));
      await service.pollOnce();

      let metrics = service.getMetrics();
      expect(metrics.lastError).toContain("rpc down");
      expect(metrics.lastErrorAt).not.toBeNull();
      expect(metrics.reconnectCount).toBe(0);

      mockChain(100, { 100: "0xhash100" }, [makeLog()]);
      await service.pollOnce();

      metrics = service.getMetrics();
      expect(metrics.reconnectCount).toBe(1); // client recreated after the failed round
      expect(metrics.sources["myshop-purchases"].lastProcessedBlock).toBe(100);
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
});
