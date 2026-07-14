import { PrismaClient } from "@prisma/client";

// Idempotent: seeds a handful of players so a fresh install has something to
// pick from. Safe to run repeatedly (upsert on the unique name).
const prisma = new PrismaClient();

const PLAYERS = ["Alice", "Bob", "Chloé", "David", "Emma"];

async function main() {
  for (const name of PLAYERS) {
    await prisma.player.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`Seeded ${PLAYERS.length} players.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
