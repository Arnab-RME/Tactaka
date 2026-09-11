// ============================================================================
// Tactaka - Manager Progression & RPG Career Engine
// ============================================================================

import { ManagerProfile, TacticalArchetype } from '../../../shared/types';
import { calculateLevelFromXP, getXPForLevel, XP_REWARDS } from '../../../shared/constants';

export function createDefaultProfile(name: string = 'Manager', archetype: TacticalArchetype = 'The Architect'): ManagerProfile {
  return {
    managerId: `mgr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name,
    avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`,
    clubCrest: '🛡️',
    level: 1,
    xp: 0,
    trophiesWon: {
      league: 0,
      worldCup: 0,
      championsLeague: 0,
    },
    record: {
      wins: 0,
      losses: 0,
      draws: 0,
      cleanSheets: 0,
      goldenBoots: 0,
    },
    archetype,
  };
}

export function awardXP(
  profile: ManagerProfile,
  amount: number,
  reason?: string
): { updatedProfile: ManagerProfile; leveledUp: boolean; newLevel: number } {
  if (profile.xp === undefined || isNaN(profile.xp)) profile.xp = 0;
  if (profile.level === undefined || isNaN(profile.level)) profile.level = 1;

  const previousLevel = profile.level;
  profile.xp += amount;
  profile.level = calculateLevelFromXP(profile.xp);

  const leveledUp = profile.level > previousLevel;
  return {
    updatedProfile: profile,
    leveledUp,
    newLevel: profile.level,
  };
}

export function recordMatchOutcome(
  profile: ManagerProfile,
  outcome: 'WIN' | 'DRAW' | 'LOSS',
  hadCleanSheet: boolean
): { xpEarned: number } {
  let xpEarned = 0;

  if (!profile.record) {
    profile.record = {
      wins: 0,
      losses: 0,
      draws: 0,
      cleanSheets: 0,
      goldenBoots: 0,
    };
  }

  if (outcome === 'WIN') {
    profile.record.wins += 1;
    xpEarned += XP_REWARDS.MATCH_WIN;
  } else if (outcome === 'DRAW') {
    profile.record.draws += 1;
    xpEarned += XP_REWARDS.MATCH_DRAW;
  } else {
    profile.record.losses += 1;
  }

  if (hadCleanSheet) {
    profile.record.cleanSheets += 1;
    xpEarned += XP_REWARDS.CLEAN_SHEET;
  }

  awardXP(profile, xpEarned);
  return { xpEarned };
}

export function recordTrophyWin(
  profile: ManagerProfile,
  format: 'LEAGUE' | 'WORLD_CUP' | 'CHAMPIONS_LEAGUE',
  wonGoldenBoot: boolean = false
): { xpEarned: number } {
  let xpEarned = XP_REWARDS.TOURNAMENT_TROPHY;

  if (!profile.trophiesWon) {
    profile.trophiesWon = {
      league: 0,
      worldCup: 0,
      championsLeague: 0,
    };
  }
  if (!profile.record) {
    profile.record = {
      wins: 0,
      losses: 0,
      draws: 0,
      cleanSheets: 0,
      goldenBoots: 0,
    };
  }

  if (format === 'LEAGUE') profile.trophiesWon.league = (profile.trophiesWon.league || 0) + 1;
  if (format === 'WORLD_CUP') profile.trophiesWon.worldCup = (profile.trophiesWon.worldCup || 0) + 1;
  if (format === 'CHAMPIONS_LEAGUE') profile.trophiesWon.championsLeague = (profile.trophiesWon.championsLeague || 0) + 1;

  if (wonGoldenBoot) {
    profile.record.goldenBoots = (profile.record.goldenBoots || 0) + 1;
    xpEarned += XP_REWARDS.GOLDEN_BOOT_AWARD;
  }

  awardXP(profile, xpEarned);
  return { xpEarned };
}

