import { Controller, Post, Body, Get, Param, HttpCode } from '@nestjs/common';
import { TypedCommandBus, TypedQueryBus } from '@/modules/shared/cqrs';
import { CorrelationId } from '@/util/decorators/correlation-id.decorator';
import { AcceptFocusSessionCommand } from '../../application/commands/accept-focus-session/accept-focus-session.command';
import { GetUserStreakQuery } from '../../application/queries/get-user-streak/get-user-streak.query';
import { AcceptSessionDto } from '../dto/accept-session.dto';
import { UserStreakResponseDto } from '../dto/user-streak-response.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Streaks')
@Controller('sessions')
export class StreaksController {
  constructor(
    private readonly commandBus: TypedCommandBus,
    private readonly queryBus: TypedQueryBus,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Accept a focus session',
    description:
      'Records a focus session for a user. Handles idempotency via sessionId, timezone conversion, and multi-day session splitting.',
  })
  @ApiBody({ type: AcceptSessionDto })
  @ApiResponse({
    status: 201,
    description: 'Session accepted successfully. Idempotent - safe to retry.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input (validation error)',
  })
  async acceptSession(
    @Body() body: AcceptSessionDto,
    @CorrelationId() correlationId: string,
  ): Promise<void> {
    await this.commandBus.execute(
      new AcceptFocusSessionCommand({
        ...body,
        correlationId,
      }),
    );
  }

  @Get('users/:userId/streak')
  @ApiOperation({
    summary: 'Get user streak',
    description:
      'Retrieves the current streak, longest streak, and qualified days count for a user.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'User streak retrieved successfully',
    type: UserStreakResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found (returns zero streak)',
  })
  async getUserStreak(
    @Param('userId') userId: string,
    @CorrelationId() correlationId: string,
  ): Promise<UserStreakResponseDto> {
    const result = await this.queryBus.execute(
      new GetUserStreakQuery({
        userId,
        correlationId,
      }),
    );

    return {
      userId: result.userId,
      currentStreak: result.currentStreak,
      longestStreak: result.longestStreak,
      lastQualifiedDate: result.lastQualifiedDate,
      qualifiedDaysCount: result.qualifiedDaysCount,
    };
  }
}
