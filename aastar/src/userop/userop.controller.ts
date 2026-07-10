import { Controller, Post, Get, Body, Param, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { UserOpService } from "./userop.service";
import { PrepareUserOpDto } from "./dto/prepare-userop.dto";
import { SubmitUserOpDto } from "./dto/submit-userop.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

/**
 * Generic gasless UserOp endpoints — the backend contract `cosSend` calls
 * (`aastar-frontend/lib/api.ts` userOpAPI). Account is resolved from the JWT.
 */
@ApiTags("userop")
@Controller("userop")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserOpController {
  constructor(private userOpService: UserOpService) {}

  @Post("prepare")
  @ApiOperation({ summary: "Phase 1: prepare a sponsored UserOp for an arbitrary call" })
  async prepare(@Request() req, @Body() dto: PrepareUserOpDto) {
    return this.userOpService.prepare(req.user.sub, dto);
  }

  @Post("submit")
  @ApiOperation({ summary: "Phase 3: submit a prepared UserOp with the ceremony assertion" })
  async submit(@Request() req, @Body() dto: SubmitUserOpDto) {
    return this.userOpService.submit(req.user.sub, dto);
  }

  @Get("status/:id")
  @ApiOperation({ summary: "Poll a UserOp's status (transactionHash appears when landed)" })
  async status(@Request() req, @Param("id") id: string) {
    return this.userOpService.getStatus(req.user.sub, id);
  }
}
