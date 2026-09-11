// ============================================================================
// Tactaka - Tactics Suite Engine
// ============================================================================

import {
  FormationType,
  FormationSlot,
  PlayingStyle,
  TacticsConfig,
  PlayerCard,
  Position,
  AutoSubRule,
} from '../../../shared/types';
import { FORMATION_CONFIGS } from '../../../shared/constants';

/**
 * Creates a fresh tactics configuration for a given formation.
 */
export function createDefaultTactics(formation: FormationType = '4-3-3'): TacticsConfig {
  const slotsTemplate = FORMATION_CONFIGS[formation];
  const slots: FormationSlot[] = slotsTemplate.map((slot) => ({
    ...slot,
    assignedPlayerId: null,
  }));

  const defaultAutoSubs: AutoSubRule[] = [
    {
      id: 'sub-rule-stamina',
      enabled: true,
      type: 'STAMINA_BELOW',
      threshold: 35,
    },
    {
      id: 'sub-rule-trailing',
      enabled: true,
      type: 'TRAILING_AFTER_70',
    },
  ];

  return {
    formation,
    playingStyle: 'Fast Counter-Attack',
    slots,
    starterIds: [],
    benchIds: [],
    autoSubs: defaultAutoSubs,
  };
}

/**
 * Validates whether a squad qualifies for a specific PlayingStyle:
 * - Tiki-Taka: Requires average Midfield PAS >= 80
 * - Fast Counter-Attack: Requires Winger/Striker PAC >= 82
 * - Direct Wing Play: Valid always
 * - Park the Bus: Valid always
 */
export function validatePlayingStyleEligibility(
  playingStyle: PlayingStyle,
  starters: PlayerCard[],
  slots: FormationSlot[]
): { eligible: boolean; reason?: string } {
  if (playingStyle === 'Tiki-Taka') {
    const midfieldPositions: Position[] = ['CDM', 'CM', 'CAM', 'LM', 'RM'];
    const midfielders = starters.filter((player) => {
      const slot = slots.find((s) => s.assignedPlayerId === player.id);
      return slot && midfieldPositions.includes(slot.label);
    });

    if (midfielders.length === 0) {
      return { eligible: false, reason: 'No midfielders fielded' };
    }

    const avgPas =
      midfielders.reduce((acc, p) => acc + p.stats.pas, 0) / midfielders.length;

    if (avgPas < 80) {
      return {
        eligible: false,
        reason: `Midfield average PAS is ${avgPas.toFixed(1)} (Need ≥ 80.0)`,
      };
    }
    return { eligible: true };
  }

  if (playingStyle === 'Fast Counter-Attack') {
    const attackPositions: Position[] = ['ST', 'LW', 'RW'];
    const attackers = starters.filter((player) => {
      const slot = slots.find((s) => s.assignedPlayerId === player.id);
      return slot && attackPositions.includes(slot.label);
    });

    if (attackers.length === 0) {
      return { eligible: false, reason: 'No attackers fielded' };
    }

    const maxPac = Math.max(...attackers.map((p) => p.stats.pac));
    if (maxPac < 82) {
      return {
        eligible: false,
        reason: `Fastest attacker has ${maxPac} PAC (Need at least one ≥ 82 PAC)`,
      };
    }
    return { eligible: true };
  }

  // Direct Wing Play and Park the Bus have no strict stat gate
  return { eligible: true };
}

/**
 * Automatically assigns squad players into slots based on position compatibility and OVR.
 * Used for AI managers and human one-tap "Auto-Fill / Optimize Lineup".
 */
export function autoAssignSquadTactics(
  squad: PlayerCard[],
  formation: FormationType = '4-3-3'
): TacticsConfig {
  const tactics = createDefaultTactics(formation);
  const availablePlayers = [...squad].filter((p) => !p.isInjured);

  // Sort descending by OVR
  availablePlayers.sort((a, b) => b.ovr - a.ovr);

  const starterIds: string[] = [];
  const assignedSet = new Set<string>();

  // Pass 1: Primary position exact matches
  for (const slot of tactics.slots) {
    const match = availablePlayers.find(
      (p) => !assignedSet.has(p.id) && p.primaryPosition === slot.label
    );
    if (match) {
      slot.assignedPlayerId = match.id;
      starterIds.push(match.id);
      assignedSet.add(match.id);
    }
  }

  // Pass 2: Secondary position matches
  for (const slot of tactics.slots) {
    if (slot.assignedPlayerId) continue;
    const match = availablePlayers.find(
      (p) =>
        !assignedSet.has(p.id) &&
        p.secondaryPositions &&
        p.secondaryPositions.includes(slot.label)
    );
    if (match) {
      slot.assignedPlayerId = match.id;
      starterIds.push(match.id);
      assignedSet.add(match.id);
    }
  }

  // Pass 3: Fill remaining unfilled starter slots with best remaining players
  for (const slot of tactics.slots) {
    if (slot.assignedPlayerId) continue;
    const remaining = availablePlayers.find((p) => !assignedSet.has(p.id));
    if (remaining) {
      slot.assignedPlayerId = remaining.id;
      starterIds.push(remaining.id);
      assignedSet.add(remaining.id);
    }
  }

  // Bench: next 5 to 7 unassigned players
  const benchIds: string[] = [];
  for (const p of availablePlayers) {
    if (!assignedSet.has(p.id) && benchIds.length < 7) {
      benchIds.push(p.id);
      assignedSet.add(p.id);
    }
  }

  tactics.starterIds = starterIds;
  tactics.benchIds = benchIds;

  // Choose best eligible playstyle
  const starters = squad.filter((p) => starterIds.includes(p.id));
  if (validatePlayingStyleEligibility('Tiki-Taka', starters, tactics.slots).eligible) {
    tactics.playingStyle = 'Tiki-Taka';
  } else if (
    validatePlayingStyleEligibility('Fast Counter-Attack', starters, tactics.slots).eligible
  ) {
    tactics.playingStyle = 'Fast Counter-Attack';
  } else {
    tactics.playingStyle = 'Direct Wing Play';
  }

  return tactics;
}
