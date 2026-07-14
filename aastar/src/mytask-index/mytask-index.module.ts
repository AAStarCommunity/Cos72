import { Module } from "@nestjs/common";
import { IndexerModule } from "../indexer/indexer.module";
import { MyTaskIndexController } from "./mytask-index.controller";
import { MyTaskIndexService } from "./mytask-index.service";

/**
 * First consumer of the shared A-8 IndexerService. Imports IndexerModule to
 * obtain the (exported) IndexerService, registers TaskEscrowV2's challenge
 * events as a source at init, and serves the /mytask/challenges read endpoints.
 */
@Module({
  imports: [IndexerModule],
  controllers: [MyTaskIndexController],
  providers: [MyTaskIndexService],
  exports: [MyTaskIndexService],
})
export class MyTaskIndexModule {}
