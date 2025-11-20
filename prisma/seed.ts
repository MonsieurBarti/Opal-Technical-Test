/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seeding database...');

  // Create demo users
  const user1 = await prisma.user.upsert({
    where: { id: '550e8400-e29b-41d4-a716-446655440001' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      timezone: 'America/New_York',
    },
  });

  const user2 = await prisma.user.upsert({
    where: { id: '550e8400-e29b-41d4-a716-446655440002' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440002',
      timezone: 'Europe/London',
    },
  });

  const user3 = await prisma.user.upsert({
    where: { id: '550e8400-e29b-41d4-a716-446655440003' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440003',
      timezone: 'Asia/Tokyo',
    },
  });

  console.log('✅ Created demo users:');
  console.log(`   - User 1 (${user1.id}) - ${user1.timezone}`);
  console.log(`   - User 2 (${user2.id}) - ${user2.timezone}`);
  console.log(`   - User 3 (${user3.id}) - ${user3.timezone}`);

  // Create some sample focus sessions for user1
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Session from 3 days ago
  await prisma.focusSession.upsert({
    where: { session_id: 'seed-session-1' },
    update: {},
    create: {
      session_id: 'seed-session-1',
      user_id: user1.id,
      start_time: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000),
      end_time: new Date(
        today.getTime() - 3 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000,
      ),
      duration_minutes: 45,
      timezone: user1.timezone,
    },
  });

  // Session from 2 days ago
  await prisma.focusSession.upsert({
    where: { session_id: 'seed-session-2' },
    update: {},
    create: {
      session_id: 'seed-session-2',
      user_id: user1.id,
      start_time: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
      end_time: new Date(
        today.getTime() - 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000,
      ),
      duration_minutes: 60,
      timezone: user1.timezone,
    },
  });

  // Session from yesterday
  await prisma.focusSession.upsert({
    where: { session_id: 'seed-session-3' },
    update: {},
    create: {
      session_id: 'seed-session-3',
      user_id: user1.id,
      start_time: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
      end_time: new Date(
        today.getTime() - 1 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000,
      ),
      duration_minutes: 30,
      timezone: user1.timezone,
    },
  });

  console.log('✅ Created sample focus sessions for User 1');

  // Create a user streak for user1
  await prisma.userStreak.upsert({
    where: { user_id: user1.id },
    update: {},
    create: {
      user_id: user1.id,
      current_streak: 3,
      longest_streak: 3,
      last_qualified_date: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
      qualified_days_count: 3,
    },
  });

  console.log('✅ Created user streak for User 1');
  console.log('\n🎉 Database seeded successfully!');
  console.log('\nYou can now test the API with these user IDs:');
  console.log(`   - ${user1.id}`);
  console.log(`   - ${user2.id}`);
  console.log(`   - ${user3.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
