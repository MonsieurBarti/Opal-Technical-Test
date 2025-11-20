import { ApiProperty } from '@nestjs/swagger';

export class UserStreakResponseDto {
  @ApiProperty({
    description: 'User UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({
    description: 'Current consecutive-day streak',
    example: 7,
  })
  currentStreak!: number;

  @ApiProperty({
    description: 'Longest streak achieved by this user',
    example: 14,
  })
  longestStreak!: number;

  @ApiProperty({
    description:
      'Last date (YYYY-MM-DD) user had a qualified day (≥30 min focus)',
    example: '2025-01-20',
    nullable: true,
  })
  lastQualifiedDate!: string | null;

  @ApiProperty({
    description: 'Total number of qualified days (for leaderboard)',
    example: 42,
  })
  qualifiedDaysCount!: number;
}
