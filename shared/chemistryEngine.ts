// ============================================================================
// Tactaka - Shared Chemistry Engine
// ============================================================================

import { PlayerCard, PlayerStats, Position, TacticsConfig } from './types';
import { CHEM_BONUS_PER_POINT, OUT_OF_POSITION_PENALTY } from './constants';

export interface ChemistryResult {
  playerChem: Record<string, number>; // playerId -> 0..3
  outOfPosition: Record<string, boolean>; // playerId -> boolean
  totalSquadChemistry: number; // 0..33
  clubCounts: Record<string, number>;
  nationCounts: Record<string, number>;
  eraCounts: Record<string, number>;
}

/**
 * Checks if a player can play in a specific pitch slot without penalty.
 */
export function isPlayerInPosition(player: PlayerCard, slotPosition: Position): boolean {
  if (player.primaryPosition === slotPosition) return true;
  if (player.secondaryPositions && player.secondaryPositions.includes(slotPosition)) return true;
  return false;
}

/**
 * Calculates chemistry for starters according to the spec:
 * +1 Chem: 2+ players from same club/era OR 3+ players from same nation
 * +2 Chem: 4+ players from same club OR 5+ players from same nation
 * +3 Chem: 6+ players from same nation/club
 */
export function calculateSquadChemistry(
  starters: PlayerCard[],
  tactics: TacticsConfig
): ChemistryResult {
  const clubCounts: Record<string, number> = {};
  const nationCounts: Record<string, number> = {};
  const eraCounts: Record<string, number> = {};
  const outOfPosition: Record<string, boolean> = {};

  // Count frequencies among active starters
  for (const player of starters) {
    if (!player) continue;
    clubCounts[player.club] = (clubCounts[player.club] || 0) + 1;
    nationCounts[player.nation] = (nationCounts[player.nation] || 0) + 1;
    if (player.era) {
      eraCounts[player.era] = (eraCounts[player.era] || 0) + 1;
    }

    // Check position matching
    const assignedSlot = tactics.slots.find((s) => s.assignedPlayerId === player.id);
    if (assignedSlot) {
      outOfPosition[player.id] = !isPlayerInPosition(player, assignedSlot.label);
    } else {
      outOfPosition[player.id] = false;
    }
  }

  const playerChem: Record<string, number> = {};
  let totalSquadChemistry = 0;

  for (const player of starters) {
    if (!player) continue;
    const clubCount = clubCounts[player.club] || 0;
    const nationCount = nationCounts[player.nation] || 0;
    const eraCount = eraCounts[player.era] || 0;

    let chem = 0;

    // Spec Rules:
    // +3 Chem: 6+ players from same nation/club
    if (nationCount >= 6 || clubCount >= 6) {
      chem = 3;
    }
    // +2 Chem: 4+ players from same club OR 5+ players from same nation
    else if (clubCount >= 4 || nationCount >= 5) {
      chem = 2;
    }
    // +1 Chem: 2+ players from same club/era OR 3+ players from same nation
    else if (clubCount >= 2 || eraCount >= 2 || nationCount >= 3) {
      chem = 1;
    }

    // Legends bonus: if Tier 1, always grant minimum 1 wildcard chem point
    if (player.tier === 1 && chem < 1) {
      chem = 1;
    }

    playerChem[player.id] = chem;
    totalSquadChemistry += chem;
  }

  return {
    playerChem,
    outOfPosition,
    totalSquadChemistry,
    clubCounts,
    nationCounts,
    eraCounts,
  };
}

/**
 * Calculates effective player stats with chemistry buffs (+2 per chem point)
 * and strict -30% penalty if out of position.
 */
export function getEffectiveStats(
  player: PlayerCard,
  chemPoints: number = 0,
  isOutOfPosition: boolean = false,
  staminaPercent: number = 100
): PlayerStats {
  const boost = chemPoints * CHEM_BONUS_PER_POINT;

  let pac = player.stats.pac + boost;
  let sho = player.stats.sho + boost;
  let pas = player.stats.pas + boost;
  let dri = player.stats.dri + boost;
  let def = player.stats.def + boost;
  let phy = player.stats.phy + boost;

  // Out of position strict -30% penalty
  if (isOutOfPosition) {
    const mult = 1 - OUT_OF_POSITION_PENALTY;
    pac = Math.round(pac * mult);
    sho = Math.round(sho * mult);
    pas = Math.round(pas * mult);
    dri = Math.round(dri * mult);
    def = Math.round(def * mult);
    phy = Math.round(phy * mult);
  }

  // Stamina < 40% imposes a -20% debuff to Pace and Physicality duels
  if (staminaPercent < 40) {
    pac = Math.round(pac * 0.8);
    phy = Math.round(phy * 0.8);
  }

  // Clamp ratings between 10 and 99
  const clamp = (val: number) => Math.max(10, Math.min(99, val));

  return {
    pac: clamp(pac),
    sho: clamp(sho),
    pas: clamp(pas),
    dri: clamp(dri),
    def: clamp(def),
    phy: clamp(phy),
  };
}
