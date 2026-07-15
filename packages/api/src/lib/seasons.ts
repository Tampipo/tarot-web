import type { Season } from "@prisma/client";
import { prisma } from "../prisma";

/** The config singleton, created on first read. */
export async function getSettings() {
  return prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

/** Calendar-safe month arithmetic (clamps e.g. Jan 31 + 1 month → Feb 28). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

async function openSeason(startedAt: Date): Promise<Season> {
  const n = await prisma.season.count();
  return prisma.season.create({
    data: { name: `Season ${n + 1}`, startedAt },
  });
}

/**
 * The season new games belong to, rolling it over first if it is due.
 *
 * Rollover is lazy — evaluated whenever a game is saved or a scoreboard is read
 * — so no scheduler is needed. A season runs `seasonPeriodMonths` from its
 * start; when that elapses the season is closed *at its boundary* and the next
 * one starts there, which keeps the cadence aligned instead of drifting to
 * whenever someone next opened the app. Quiet stretches therefore leave real
 * (empty) seasons in the history rather than a gap. null period = manual only.
 */
export async function currentSeason(): Promise<Season> {
  const settings = await getSettings();

  let season =
    (await prisma.season.findFirst({
      where: { endedAt: null },
      orderBy: { startedAt: "desc" },
    })) ?? (await openSeason(new Date()));

  const months = settings.seasonPeriodMonths;
  if (!months || months < 1) return season;

  // Guard against a pathological catch-up (clock skew, long-dormant install).
  for (let i = 0; i < 240; i++) {
    const due = addMonths(season.startedAt, months);
    if (Date.now() < due.getTime()) break;
    await prisma.season.update({ where: { id: season.id }, data: { endedAt: due } });
    season = await openSeason(due);
  }
  return season;
}

/** Close the open season now and start a fresh one — the manual score reset. */
export async function startNewSeason(name?: string): Promise<Season> {
  const now = new Date();
  const open = await prisma.season.findFirst({ where: { endedAt: null } });
  if (open) {
    await prisma.season.update({ where: { id: open.id }, data: { endedAt: now } });
  }
  const season = await openSeason(now);
  if (name?.trim()) {
    return prisma.season.update({
      where: { id: season.id },
      data: { name: name.trim() },
    });
  }
  return season;
}
