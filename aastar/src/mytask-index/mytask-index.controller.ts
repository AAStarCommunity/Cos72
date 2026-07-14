import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { BYTES32_RE, DEFAULT_RECENT_LIMIT, MAX_RECENT_LIMIT } from "./mytask-index.constants";
import { MyTaskIndexService } from "./mytask-index.service";

/** Strict decimal-integer parse (mirrors indexer.controller). */
function parseStrictInt(name: string, value?: string): number | undefined {
  if (value === undefined || value === "") return undefined;
  if (!/^\d+$/.test(value)) {
    throw new BadRequestException(`Query param "${name}" must be a non-negative integer`);
  }
  return Number.parseInt(value, 10);
}

@ApiTags("mytask")
@Controller("mytask")
export class MyTaskIndexController {
  constructor(private readonly service: MyTaskIndexService) {}

  @Get("challenges")
  @ApiOperation({
    summary: "Challengers of a task (public read-only) — from indexed TaskChallenged events",
  })
  @ApiQuery({ name: "taskId", required: true, description: "Task id (0x-prefixed bytes32)" })
  async getChallenges(@Query("taskId") taskId?: string) {
    if (!taskId || !BYTES32_RE.test(taskId)) {
      throw new BadRequestException('Query param "taskId" must be a 0x-prefixed bytes32');
    }
    return this.service.getChallengesByTaskId(taskId);
  }

  @Get("challenges/recent")
  @ApiOperation({ summary: "Most recent challenges across all tasks (public read-only)" })
  @ApiQuery({
    name: "limit",
    required: false,
    description: `Page size (default ${DEFAULT_RECENT_LIMIT}, max ${MAX_RECENT_LIMIT})`,
  })
  async getRecentChallenges(@Query("limit") limit?: string) {
    const parsed = parseStrictInt("limit", limit) ?? DEFAULT_RECENT_LIMIT;
    const clamped = Math.min(Math.max(parsed, 1), MAX_RECENT_LIMIT);
    return this.service.getRecentChallenges(clamped);
  }
}
