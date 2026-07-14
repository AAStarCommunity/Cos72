import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { IndexerService } from "./indexer.service";

/** Strict decimal-integer parse: "10abc", "1.5", "-1" are all rejected. */
function parseStrictInt(name: string, value?: string): number | undefined {
  if (value === undefined || value === "") return undefined;
  if (!/^\d+$/.test(value)) {
    throw new BadRequestException(`Query param "${name}" must be a non-negative integer`);
  }
  return Number.parseInt(value, 10);
}

@ApiTags("indexer")
@Controller("indexer")
export class IndexerController {
  constructor(private readonly indexerService: IndexerService) {}

  @Get("metrics")
  @ApiOperation({ summary: "Indexer health metrics (public read-only)" })
  getMetrics() {
    return this.indexerService.getMetrics();
  }

  @Get("events")
  @ApiOperation({ summary: "Query indexed events (public read-only, newest first)" })
  @ApiQuery({ name: "source", required: false, description: "Filter by registered source key" })
  @ApiQuery({ name: "limit", required: false, description: "Page size (default 50, max 200)" })
  @ApiQuery({ name: "offset", required: false, description: "Pagination offset (default 0)" })
  async getEvents(
    @Query("source") source?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    if (source && !this.indexerService.hasSource(source)) {
      throw new BadRequestException(`Unknown indexer source: ${source}`);
    }
    return this.indexerService.queryEvents({
      source: source || undefined,
      limit: parseStrictInt("limit", limit),
      offset: parseStrictInt("offset", offset),
    });
  }
}
