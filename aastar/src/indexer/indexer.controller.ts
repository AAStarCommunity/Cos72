import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { IndexerService } from "./indexer.service";

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
  @ApiQuery({ name: "source", required: false, description: "Filter by source key" })
  @ApiQuery({ name: "limit", required: false, description: "Page size (default 50, max 200)" })
  @ApiQuery({ name: "offset", required: false, description: "Pagination offset (default 0)" })
  async getEvents(
    @Query("source") source?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    const parsedLimit = Number.parseInt(limit ?? "", 10);
    const parsedOffset = Number.parseInt(offset ?? "", 10);
    return this.indexerService.queryEvents({
      source: source || undefined,
      limit: Number.isNaN(parsedLimit) ? undefined : parsedLimit,
      offset: Number.isNaN(parsedOffset) ? undefined : parsedOffset,
    });
  }
}
