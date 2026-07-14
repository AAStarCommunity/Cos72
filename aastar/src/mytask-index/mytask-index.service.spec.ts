import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { IndexerService } from "../indexer/indexer.service";
import { IndexedEventRecord } from "../indexer/indexer.types";
import { MyTaskIndexService } from "./mytask-index.service";
import {
  MYTASK_CHALLENGES_SOURCE,
  MYTASK_ESCROW_DEFAULT_ADDRESS,
  MYTASK_INDEX_DEFAULT_FROM_BLOCK,
} from "./mytask-index.constants";

const TASK_A = "0x" + "a".repeat(64);
const TASK_B = "0x" + "b".repeat(64);
const CHALLENGER_1 = "0x1111111111111111111111111111111111111111";
const CHALLENGER_2 = "0x2222222222222222222222222222222222222222";

/**
 * In-memory IndexerService double. Only the methods MyTaskIndexService touches
 * are implemented: registerSource / hasSource / queryEvents.
 */
class FakeIndexer {
  registerSource = jest.fn();
  private records: IndexedEventRecord[] = [];
  private sources = new Set<string>();

  seed(records: IndexedEventRecord[]) {
    this.records = records;
    this.sources.add(MYTASK_CHALLENGES_SOURCE);
  }

  hasSource(key: string) {
    return this.sources.has(key);
  }

  // Mirrors IndexerService.queryEvents: newest-first, clamped, paginated.
  async queryEvents(options: { source?: string; limit?: number; offset?: number }) {
    const limit = Math.min(Math.max(Math.floor(options.limit ?? 50), 1), 200);
    const offset = Math.max(Math.floor(options.offset ?? 0), 0);
    const all = [...this.records]
      .filter(e => (options.source ? e.source === options.source : true))
      .sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
    return {
      source: options.source ?? null,
      limit,
      offset,
      total: all.length,
      events: all.slice(offset, offset + limit),
    };
  }
}

function challengedRecord(
  taskId: string,
  challenger: string,
  stake: string,
  blockNumber: number,
  logIndex = 0
): IndexedEventRecord {
  return {
    id: `0xtx${blockNumber}-${logIndex}:${logIndex}`,
    source: MYTASK_CHALLENGES_SOURCE,
    eventName: "TaskChallenged",
    contractAddress: MYTASK_ESCROW_DEFAULT_ADDRESS,
    blockNumber,
    blockHash: `0xhash${blockNumber}`,
    txHash: `0xtx${blockNumber}-${logIndex}`,
    logIndex,
    args: { taskId, challenger, stake },
    createdAt: new Date().toISOString(),
  };
}

function resolvedRecord(
  taskId: string,
  challengeAccepted: boolean,
  blockNumber: number,
  logIndex = 0
): IndexedEventRecord {
  return {
    id: `0xtxr${blockNumber}-${logIndex}:${logIndex}`,
    source: MYTASK_CHALLENGES_SOURCE,
    eventName: "ChallengeResolved",
    contractAddress: MYTASK_ESCROW_DEFAULT_ADDRESS,
    blockNumber,
    blockHash: `0xhash${blockNumber}`,
    txHash: `0xtxr${blockNumber}-${logIndex}`,
    logIndex,
    args: { taskId, challengeAccepted },
    createdAt: new Date().toISOString(),
  };
}

async function buildService(
  indexer: FakeIndexer,
  cfg: Record<string, unknown> = {}
): Promise<MyTaskIndexService> {
  const merged: Record<string, unknown> = { ethRpcUrl: "http://localhost:8545", ...cfg };
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      MyTaskIndexService,
      { provide: IndexerService, useValue: indexer },
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn((key: string, fallback?: unknown) =>
            key in merged ? merged[key] : fallback
          ),
        },
      },
    ],
  }).compile();
  return module.get<MyTaskIndexService>(MyTaskIndexService);
}

describe("MyTaskIndexService", () => {
  let indexer: FakeIndexer;

  beforeEach(() => {
    indexer = new FakeIndexer();
  });

  describe("source registration", () => {
    it("registers the challenges source when an address is configured (default)", async () => {
      const service = await buildService(indexer);
      service.onModuleInit();

      expect(indexer.registerSource).toHaveBeenCalledTimes(1);
      expect(indexer.registerSource).toHaveBeenCalledWith(
        expect.objectContaining({
          key: MYTASK_CHALLENGES_SOURCE,
          address: MYTASK_ESCROW_DEFAULT_ADDRESS,
          events: ["TaskChallenged", "ChallengeResolved"],
          fromBlock: MYTASK_INDEX_DEFAULT_FROM_BLOCK,
        })
      );
    });

    it("honors an explicit MYTASK_ESCROW_ADDRESS + MYTASK_INDEX_FROM_BLOCK", async () => {
      const addr = "0x9999999999999999999999999999999999999999";
      const service = await buildService(indexer, {
        MYTASK_ESCROW_ADDRESS: addr,
        MYTASK_INDEX_FROM_BLOCK: "12345",
      });
      service.onModuleInit();

      expect(indexer.registerSource).toHaveBeenCalledWith(
        expect.objectContaining({ address: addr, fromBlock: 12345 })
      );
    });

    it("skips registration when MYTASK_ESCROW_ADDRESS is empty (disabled)", async () => {
      const service = await buildService(indexer, { MYTASK_ESCROW_ADDRESS: "" });
      service.onModuleInit();
      expect(indexer.registerSource).not.toHaveBeenCalled();
      expect(service.isRegistered()).toBe(false);
    });

    it("skips registration on an invalid address", async () => {
      const service = await buildService(indexer, { MYTASK_ESCROW_ADDRESS: "not-an-address" });
      service.onModuleInit();
      expect(indexer.registerSource).not.toHaveBeenCalled();
    });

    it("skips registration when no RPC URL is configured", async () => {
      const service = await buildService(indexer, { ethRpcUrl: undefined });
      service.onModuleInit();
      expect(indexer.registerSource).not.toHaveBeenCalled();
    });

    it("falls back to the default fromBlock on an invalid MYTASK_INDEX_FROM_BLOCK", async () => {
      const service = await buildService(indexer, { MYTASK_INDEX_FROM_BLOCK: "-5" });
      service.onModuleInit();
      expect(indexer.registerSource).toHaveBeenCalledWith(
        expect.objectContaining({ fromBlock: MYTASK_INDEX_DEFAULT_FROM_BLOCK })
      );
    });

    it("does not crash boot when registerSource throws", async () => {
      indexer.registerSource.mockImplementation(() => {
        throw new Error("already registered");
      });
      const service = await buildService(indexer);
      expect(() => service.onModuleInit()).not.toThrow();
      expect(service.isRegistered()).toBe(false);
    });
  });

  describe("getChallengesByTaskId", () => {
    it("filters TaskChallenged to the requested taskId and decodes challenger + stake", async () => {
      indexer.seed([
        challengedRecord(TASK_A, CHALLENGER_1, "1000", 200, 0),
        challengedRecord(TASK_B, CHALLENGER_2, "5000", 201, 0),
        challengedRecord(TASK_A, CHALLENGER_2, "2000", 205, 1),
      ]);
      const service = await buildService(indexer);

      const result = await service.getChallengesByTaskId(TASK_A);

      expect(result.taskId).toBe(TASK_A);
      expect(result.challenges).toHaveLength(2);
      // oldest-first
      expect(result.challenges[0]).toMatchObject({
        challenger: CHALLENGER_1,
        stake: "1000",
        blockNumber: 200,
      });
      expect(result.challenges[1]).toMatchObject({ challenger: CHALLENGER_2, stake: "2000" });
      expect(result.resolution).toBeNull();
    });

    it("matches taskId case-insensitively", async () => {
      indexer.seed([challengedRecord(TASK_A, CHALLENGER_1, "1000", 200)]);
      const service = await buildService(indexer);
      const result = await service.getChallengesByTaskId(TASK_A.toUpperCase().replace("0X", "0x"));
      expect(result.challenges).toHaveLength(1);
    });

    it("attaches the latest ChallengeResolved for the task", async () => {
      indexer.seed([
        challengedRecord(TASK_A, CHALLENGER_1, "1000", 200),
        resolvedRecord(TASK_A, false, 210),
        resolvedRecord(TASK_A, true, 220),
      ]);
      const service = await buildService(indexer);
      const result = await service.getChallengesByTaskId(TASK_A);
      expect(result.resolution).toMatchObject({ challengeAccepted: true, blockNumber: 220 });
    });

    it("returns empty for an unknown taskId", async () => {
      indexer.seed([challengedRecord(TASK_A, CHALLENGER_1, "1000", 200)]);
      const service = await buildService(indexer);
      const result = await service.getChallengesByTaskId(TASK_B);
      expect(result.challenges).toHaveLength(0);
      expect(result.resolution).toBeNull();
    });
  });

  describe("getRecentChallenges", () => {
    it("returns newest-first challenges clamped to the limit", async () => {
      indexer.seed([
        challengedRecord(TASK_A, CHALLENGER_1, "1000", 200),
        challengedRecord(TASK_B, CHALLENGER_2, "2000", 205),
        challengedRecord(TASK_A, CHALLENGER_2, "3000", 210),
        resolvedRecord(TASK_A, true, 220), // must be filtered out
      ]);
      const service = await buildService(indexer);

      const result = await service.getRecentChallenges(2);
      expect(result.limit).toBe(2);
      expect(result.challenges).toHaveLength(2);
      expect(result.challenges[0].blockNumber).toBe(210); // newest first
      expect(result.challenges[1].blockNumber).toBe(205);
      expect(result.challenges.every(c => c.stake !== undefined)).toBe(true);
    });

    it("only returns TaskChallenged events (no resolutions)", async () => {
      indexer.seed([resolvedRecord(TASK_A, true, 220)]);
      const service = await buildService(indexer);
      const result = await service.getRecentChallenges(10);
      expect(result.challenges).toHaveLength(0);
    });
  });

  describe("bytes32 validation helper", () => {
    it("accepts a well-formed bytes32 and rejects malformed input", () => {
      expect(MyTaskIndexService.isBytes32(TASK_A)).toBe(true);
      expect(MyTaskIndexService.isBytes32("0x123")).toBe(false);
      expect(MyTaskIndexService.isBytes32("deadbeef")).toBe(false);
    });
  });
});
