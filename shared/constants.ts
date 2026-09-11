// ============================================================================
// Tactaka - Shared Constants, Formulas & Configurations
// ============================================================================

import { FormationType, FormationSlot, PlayingStyle, TacticalArchetype } from './types';

// Purse & Squad Constraints
export const STARTING_PURSE = 100.0; // $100.0M
export const MIN_SQUAD_SIZE = 11;
export const TARGET_ROTATION_SIZE = 16;
export const MAX_SQUAD_SIZE = 24;
export const MIN_CARD_PRICE = 0.5; // $0.5M base slot reserve cost

// Auction Timers
export const AUCTION_BASE_COUNTDOWN = 12; // 12 seconds per card (regular round)
export const AUCTION_CLEARANCE_COUNTDOWN = 10; // 10 seconds per card (clearance round)
export const CLEARANCE_BASE_PRICE = 0.5; // $0.5M starting price for all clearance cards
export const AUCTION_CLUTCH_THRESHOLD = 4; // <= 4s triggers clutch
export const AUCTION_CLUTCH_RESET_TIME = 5; // Reset to 5s in clutch

// Tactics Lockdown
export const TACTICS_LOCKDOWN_SECONDS = 180; // 3-minute lockdown window

// Dynamic Escalation Math:
// - $5.0M to $20.0M: +$1.0M increments
// - $20.0M to $40.0M: +$2.0M increments
// - $40.0M and above: +$5.0M increments
// - Under $5.0M: +$0.5M increments
export function calculateNextBid(currentBid: number, basePrice: number): number {
  if (currentBid <= 0) {
    return basePrice;
  }
  if (currentBid < 5.0) {
    return Math.round((currentBid + 0.5) * 10) / 10;
  } else if (currentBid < 20.0) {
    return Math.round((currentBid + 1.0) * 10) / 10;
  } else if (currentBid < 40.0) {
    return Math.round((currentBid + 2.0) * 10) / 10;
  } else {
    return Math.round((currentBid + 5.0) * 10) / 10;
  }
}

// Anti-Bankruptcy Guardrail
// Purse - Bid Amount >= (Mandatory Unfilled Slots to reach 11) * $0.5M
export function canAffordBid(purse: number, bidAmount: number, currentSquadCount: number): boolean {
  const mandatoryUnfilled = Math.max(0, MIN_SQUAD_SIZE - (currentSquadCount + 1));
  const reserveNeeded = mandatoryUnfilled * MIN_CARD_PRICE;
  return purse - bidAmount >= reserveNeeded;
}

// Manager Progression & XP Formulas
// XP required for Level N = 500 * (N^1.5)
export function getXPForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(500 * Math.pow(level, 1.5));
}

export function calculateLevelFromXP(totalXP: number): number {
  let level = 1;
  while (true) {
    const nextLevelXP = getXPForLevel(level + 1);
    if (totalXP >= nextLevelXP) {
      level++;
    } else {
      break;
    }
  }
  return level;
}

export const XP_REWARDS = {
  MATCH_WIN: 100,
  MATCH_DRAW: 35,
  CLEAN_SHEET: 25,
  TOURNAMENT_TROPHY: 500,
  GOLDEN_BOOT_AWARD: 50,
};

export function createDefaultProfile(
  name: string = 'Manager',
  archetype: TacticalArchetype = 'The Architect'
) {
  return {
    managerId: `mgr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name,
    clubName: 'Thunderbolts FC',
    avatarUrl: `https://api.dicebear.com/7.x/personas/svg?seed=${name}`,
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

// Tactical Archetype Passives
export const ARCHETYPE_INFO: Record<
  TacticalArchetype,
  { name: string; description: string; badge: string; icon: string }
> = {
  'The Gegenpresser': {
    name: 'The Gegenpresser',
    description: '+10% defensive duel wins in opponent final third; +15% in-match stamina drain.',
    badge: 'HIGH PRESS',
    icon: 'Zap',
  },
  'The Architect': {
    name: 'The Architect',
    description: '+8% midfield duel success rate during build-up phases.',
    badge: 'PLAYMAKER',
    icon: 'Compass',
  },
  'The Catenaccio': {
    name: 'The Catenaccio',
    description: '+12% block and tackle success rate when protecting a lead after minute 70.',
    badge: 'THE WALL',
    icon: 'Shield',
  },
  'The Motivator': {
    name: 'The Motivator',
    description: '-25% attribute fatigue penalties applied to substitutes entering after minute 60.',
    badge: 'SUPER SUB',
    icon: 'Flame',
  },
};

// Chemistry Rules
// +1 Chem: 2+ same club/era OR 3+ same nation
// +2 Chem: 4+ same club OR 5+ same nation
// +3 Chem: 6+ same nation/club
// Each chem point: +2 to all core face stats. Zero chem = +0. Out-of-position: -30% stat penalty.
export const CHEM_BONUS_PER_POINT = 2;
export const OUT_OF_POSITION_PENALTY = 0.3; // -30%

// Formations & Pitch Slots
// Coordinates: x (0 to 100, width left to right), y (0 to 100, bottom GK to top ST)
export const FORMATION_CONFIGS: Record<FormationType, FormationSlot[]> = {
  '4-3-3': [
    { id: 'pos-gk', label: 'GK', x: 50, y: 10, assignedPlayerId: null },
    { id: 'pos-lb', label: 'LB', x: 18, y: 28, assignedPlayerId: null },
    { id: 'pos-cb1', label: 'CB', x: 38, y: 26, assignedPlayerId: null },
    { id: 'pos-cb2', label: 'CB', x: 62, y: 26, assignedPlayerId: null },
    { id: 'pos-rb', label: 'RB', x: 82, y: 28, assignedPlayerId: null },
    { id: 'pos-cm1', label: 'CM', x: 30, y: 52, assignedPlayerId: null },
    { id: 'pos-cdm', label: 'CDM', x: 50, y: 44, assignedPlayerId: null },
    { id: 'pos-cm2', label: 'CM', x: 70, y: 52, assignedPlayerId: null },
    { id: 'pos-lw', label: 'LW', x: 20, y: 78, assignedPlayerId: null },
    { id: 'pos-st', label: 'ST', x: 50, y: 86, assignedPlayerId: null },
    { id: 'pos-rw', label: 'RW', x: 80, y: 78, assignedPlayerId: null },
  ],
  '4-2-3-1': [
    { id: 'pos-gk', label: 'GK', x: 50, y: 10, assignedPlayerId: null },
    { id: 'pos-lb', label: 'LB', x: 18, y: 28, assignedPlayerId: null },
    { id: 'pos-cb1', label: 'CB', x: 38, y: 26, assignedPlayerId: null },
    { id: 'pos-cb2', label: 'CB', x: 62, y: 26, assignedPlayerId: null },
    { id: 'pos-rb', label: 'RB', x: 82, y: 28, assignedPlayerId: null },
    { id: 'pos-cdm1', label: 'CDM', x: 38, y: 44, assignedPlayerId: null },
    { id: 'pos-cdm2', label: 'CDM', x: 62, y: 44, assignedPlayerId: null },
    { id: 'pos-cam1', label: 'CAM', x: 24, y: 66, assignedPlayerId: null },
    { id: 'pos-cam2', label: 'CAM', x: 50, y: 68, assignedPlayerId: null },
    { id: 'pos-cam3', label: 'CAM', x: 76, y: 66, assignedPlayerId: null },
    { id: 'pos-st', label: 'ST', x: 50, y: 88, assignedPlayerId: null },
  ],
  '3-5-2': [
    { id: 'pos-gk', label: 'GK', x: 50, y: 10, assignedPlayerId: null },
    { id: 'pos-cb1', label: 'CB', x: 28, y: 26, assignedPlayerId: null },
    { id: 'pos-cb2', label: 'CB', x: 50, y: 24, assignedPlayerId: null },
    { id: 'pos-cb3', label: 'CB', x: 72, y: 26, assignedPlayerId: null },
    { id: 'pos-lm', label: 'LM', x: 14, y: 52, assignedPlayerId: null },
    { id: 'pos-cdm', label: 'CDM', x: 50, y: 42, assignedPlayerId: null },
    { id: 'pos-cm', label: 'CM', x: 50, y: 60, assignedPlayerId: null },
    { id: 'pos-rm', label: 'RM', x: 86, y: 52, assignedPlayerId: null },
    { id: 'pos-cam', label: 'CAM', x: 50, y: 72, assignedPlayerId: null },
    { id: 'pos-st1', label: 'ST', x: 36, y: 86, assignedPlayerId: null },
    { id: 'pos-st2', label: 'ST', x: 64, y: 86, assignedPlayerId: null },
  ],
  '4-4-2': [
    { id: 'pos-gk', label: 'GK', x: 50, y: 10, assignedPlayerId: null },
    { id: 'pos-lb', label: 'LB', x: 18, y: 28, assignedPlayerId: null },
    { id: 'pos-cb1', label: 'CB', x: 38, y: 26, assignedPlayerId: null },
    { id: 'pos-cb2', label: 'CB', x: 62, y: 26, assignedPlayerId: null },
    { id: 'pos-rb', label: 'RB', x: 82, y: 28, assignedPlayerId: null },
    { id: 'pos-lm', label: 'LM', x: 18, y: 54, assignedPlayerId: null },
    { id: 'pos-cm1', label: 'CM', x: 38, y: 52, assignedPlayerId: null },
    { id: 'pos-cm2', label: 'CM', x: 62, y: 52, assignedPlayerId: null },
    { id: 'pos-rm', label: 'RM', x: 82, y: 54, assignedPlayerId: null },
    { id: 'pos-st1', label: 'ST', x: 38, y: 84, assignedPlayerId: null },
    { id: 'pos-st2', label: 'ST', x: 62, y: 84, assignedPlayerId: null },
  ],
  '5-2-3': [
    { id: 'pos-gk', label: 'GK', x: 50, y: 10, assignedPlayerId: null },
    { id: 'pos-lb', label: 'LB', x: 15, y: 30, assignedPlayerId: null },
    { id: 'pos-cb1', label: 'CB', x: 32, y: 24, assignedPlayerId: null },
    { id: 'pos-cb2', label: 'CB', x: 50, y: 22, assignedPlayerId: null },
    { id: 'pos-cb3', label: 'CB', x: 68, y: 24, assignedPlayerId: null },
    { id: 'pos-rb', label: 'RB', x: 85, y: 30, assignedPlayerId: null },
    { id: 'pos-cm1', label: 'CM', x: 38, y: 50, assignedPlayerId: null },
    { id: 'pos-cm2', label: 'CM', x: 62, y: 50, assignedPlayerId: null },
    { id: 'pos-lw', label: 'LW', x: 22, y: 78, assignedPlayerId: null },
    { id: 'pos-st', label: 'ST', x: 50, y: 86, assignedPlayerId: null },
    { id: 'pos-rw', label: 'RW', x: 78, y: 78, assignedPlayerId: null },
  ],
  '4-1-2-1-2': [
    { id: 'pos-gk', label: 'GK', x: 50, y: 10, assignedPlayerId: null },
    { id: 'pos-lb', label: 'LB', x: 18, y: 28, assignedPlayerId: null },
    { id: 'pos-cb1', label: 'CB', x: 38, y: 26, assignedPlayerId: null },
    { id: 'pos-cb2', label: 'CB', x: 62, y: 26, assignedPlayerId: null },
    { id: 'pos-rb', label: 'RB', x: 82, y: 28, assignedPlayerId: null },
    { id: 'pos-cdm', label: 'CDM', x: 50, y: 42, assignedPlayerId: null },
    { id: 'pos-lm', label: 'LM', x: 22, y: 56, assignedPlayerId: null },
    { id: 'pos-rm', label: 'RM', x: 78, y: 56, assignedPlayerId: null },
    { id: 'pos-cam', label: 'CAM', x: 50, y: 68, assignedPlayerId: null },
    { id: 'pos-st1', label: 'ST', x: 38, y: 86, assignedPlayerId: null },
    { id: 'pos-st2', label: 'ST', x: 62, y: 86, assignedPlayerId: null },
  ],
};

// Playing Style requirements & descriptions
export const PLAYING_STYLE_INFO: Record<
  PlayingStyle,
  { name: string; description: string; reqDescription: string }
> = {
  'Tiki-Taka': {
    name: 'Tiki-Taka',
    description: 'Increases short-passing build-up retention; boosts box shot accuracy.',
    reqDescription: 'Requires average Midfield PAS ≥ 80',
  },
  'Fast Counter-Attack': {
    name: 'Fast Counter-Attack',
    description: 'Sacrifices midfield possession; unlocks rapid transition 1v1 duels.',
    reqDescription: 'Requires Winger/Striker PAC ≥ 82',
  },
  'Direct Wing Play': {
    name: 'Direct Wing Play',
    description: 'Maximizes crossing duels; triggers aerial headers favored by high PHY forwards.',
    reqDescription: 'Best with tall/high-PHY forwards and crossers',
  },
  'Park the Bus': {
    name: 'Park the Bus',
    description: 'Dramatically lowers opponent shooting opportunities; limits offensive transition to 15%.',
    reqDescription: 'Heavy defensive posture, ideal for preserving leads',
  },
};
