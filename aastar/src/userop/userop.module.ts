import { Module } from "@nestjs/common";
import { UserOpService } from "./userop.service";
import { UserOpController } from "./userop.controller";

// YAAA_SERVER_CLIENT + ConfigService are global providers (SdkModule / ConfigModule),
// so no imports are needed here — mirrors TransferModule.
@Module({
  providers: [UserOpService],
  controllers: [UserOpController],
})
export class UserOpModule {}
