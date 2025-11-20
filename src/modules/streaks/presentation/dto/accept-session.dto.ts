import { z } from 'zod';
import { ZodSchema } from '@/util/decorators/zod-schema.decorator';
import { ApiProperty } from '@nestjs/swagger';

const AcceptSessionDtoSchema = z.object({
  sessionId: z
    .string()
    .min(1)
    .describe('Unique session identifier for idempotency'),
  userId: z.uuid().describe('User UUID'),
  startTime: z.coerce.date().describe('Session start time (ISO 8601 format)'),
  endTime: z.coerce.date().describe('Session end time (ISO 8601 format)'),
  timezone: z
    .string()
    .min(1)
    .describe('IANA timezone (e.g., America/New_York, Europe/London)'),
});

@ZodSchema(AcceptSessionDtoSchema)
export class AcceptSessionDto {
  @ApiProperty({
    description: 'Unique session identifier for idempotency',
    example: 'session_123abc',
  })
  sessionId!: string;

  @ApiProperty({
    description: 'User UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({
    description: 'Session start time (ISO 8601 format)',
    example: '2025-01-20T10:00:00Z',
  })
  startTime!: Date;

  @ApiProperty({
    description: 'Session end time (ISO 8601 format)',
    example: '2025-01-20T11:30:00Z',
  })
  endTime!: Date;

  @ApiProperty({
    description: 'IANA timezone (e.g., America/New_York, Europe/London)',
    example: 'America/New_York',
  })
  timezone!: string;
}
