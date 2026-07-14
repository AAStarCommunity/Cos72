import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getDataSourceToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { IndexerService } from "./indexer.service";
import { IndexerController } from "./indexer.controller";
import { INDEXER_PERSISTENCE } from "./persistence/indexer-persistence.interface";
import { IndexerJsonAdapter } from "./persistence/indexer-json.adapter";
import { IndexerPostgresAdapter } from "./persistence/indexer-postgres.adapter";

/**
 * Shared on-chain event indexing infrastructure.
 * Pure foundation: registers NO sources by default — consumer modules import
 * this module and call IndexerService.registerSource() at their own init.
 * Persistence follows the DB_TYPE json/postgres split of DatabaseModule; the
 * postgres adapter reuses the global TypeORM DataSource via raw SQL so the
 * shared entity list stays untouched.
 */
@Module({
  providers: [
    IndexerJsonAdapter,
    {
      provide: INDEXER_PERSISTENCE,
      useFactory: (
        configService: ConfigService,
        jsonAdapter: IndexerJsonAdapter,
        dataSource?: DataSource
      ) => {
        const dbType = configService.get<string>("DB_TYPE", "json");
        if (dbType === "postgres") {
          if (!dataSource) {
            throw new Error(
              "Indexer: DB_TYPE=postgres but no TypeORM DataSource available (is DatabaseModule loaded?)"
            );
          }
          return new IndexerPostgresAdapter(dataSource);
        }
        return jsonAdapter;
      },
      inject: [ConfigService, IndexerJsonAdapter, { token: getDataSourceToken(), optional: true }],
    },
    IndexerService,
  ],
  controllers: [IndexerController],
  exports: [IndexerService],
})
export class IndexerModule {}
