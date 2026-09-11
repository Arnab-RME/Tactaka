// ============================================================================
// Tactaka - Match Simulation Engine (Possession Duel Math)
// ============================================================================

import {
  MatchFixture,
  MatchCycleEvent,
  MatchStats,
  PlayerCard,
  Position,
  LobbyManager,
  TacticalArchetype,
  PlayingStyle,
} from '../../../shared/types';
import { calculateSquadChemistry, getEffectiveStats } from './chemistryEngine';
import { createAcademyGhostPlayer } from '../playerDatabase';

const MINUTES_MAP = [6, 13, 20, 27, 34, 41, 48, 55, 62, 69, 76, 82, 87, 90];

interface TeamMatchState {
  manager: LobbyManager;
  starters: PlayerCard[];
  bench: PlayerCard[];
  staminaMap: Record<string, number>; // playerId -> 0..100
  effectiveStats: Record<string, ReturnType<typeof getEffectiveStats>>;
  isSubbedInAfter60: Record<string, boolean>;
  score: number;
  xG: number;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  possessionTicks: number;
}

export function simulateMatch(
  fixture: MatchFixture,
  homeManager: LobbyManager,
  awayManager: LobbyManager
): MatchFixture {
  // Setup Teams & Roster validation (Academy ghost players if fewer than 11)
  const homeState = initializeTeamState(homeManager);
  const awayState = initializeTeamState(awayManager);

  const events: MatchCycleEvent[] = [];
  const playerRatings: Record<string, number> = {};

  // Initialize player ratings at 6.0
  [...homeState.starters, ...awayState.starters].forEach((p) => {
    playerRatings[p.id] = 6.0;
  });

  let currentHomeScore = 0;
  let currentAwayScore = 0;

  // 14 Discrete Possession Cycles
  for (let cycleIndex = 0; cycleIndex < 14; cycleIndex++) {
    const minute = MINUTES_MAP[cycleIndex];

    // Drain stamina: 0.85% per minute played (scaled by cycle interval ~6.4 mins)
    drainStamina(homeState, minute);
    drainStamina(awayState, minute);

    // Evaluate Auto-Sub rules
    evaluateAutoSubs(homeState, minute, currentHomeScore, currentAwayScore);
    evaluateAutoSubs(awayState, minute, currentAwayScore, currentHomeScore);

    // Determine attacking vs defending team for this cycle
    // Alternates base chance, modified by playing style / midfield dominance
    const homeMidPas = getMidfieldAvg(homeState, 'pas');
    const awayMidPas = getMidfieldAvg(awayState, 'pas');

    let homeAttackBias = homeMidPas / (homeMidPas + awayMidPas);
    if (homeManager.tactics.playingStyle === 'Park the Bus') homeAttackBias *= 0.75;
    if (awayManager.tactics.playingStyle === 'Park the Bus') homeAttackBias *= 1.25;

    const isHomeAttacking = Math.random() < homeAttackBias;
    const attState = isHomeAttacking ? homeState : awayState;
    const defState = isHomeAttacking ? awayState : homeState;
    const attIsHome = isHomeAttacking;

    // Execute 3-Phase Possession Cycle
    const cycleEvents = resolvePossessionCycle(
      cycleIndex,
      minute,
      attState,
      defState,
      attIsHome,
      currentHomeScore,
      currentAwayScore,
      playerRatings
    );

    for (const ev of cycleEvents) {
      currentHomeScore = ev.score.home;
      currentAwayScore = ev.score.away;
      events.push(ev);
    }
  }

  // Check extra time and penalties if knockout and tied
  let isExtraTime = false;
  let isPenalties = false;
  let homePenaltyScore: number | undefined = undefined;
  let awayPenaltyScore: number | undefined = undefined;

  if (currentHomeScore === currentAwayScore && fixture.roundName.toLowerCase().includes('final')) {
    isExtraTime = true;
    // Extra time simulated momentum check
    if (Math.random() < 0.25) {
      if (Math.random() < 0.5) {
        currentHomeScore += 1;
        events.push(createGoalEvent(118, homeState, awayState, true, currentHomeScore, currentAwayScore));
      } else {
        currentAwayScore += 1;
        events.push(createGoalEvent(118, awayState, homeState, false, currentHomeScore, currentAwayScore));
      }
    }

    if (currentHomeScore === currentAwayScore) {
      isPenalties = true;
      const shootout = simulatePenalties();
      homePenaltyScore = shootout.home;
      awayPenaltyScore = shootout.away;
    }
  }

  // Injury check (5% per player)
  const injuries: { playerId: string; matches: number }[] = [];
  [...homeState.starters, ...awayState.starters].forEach((p) => {
    if (Math.random() < 0.05) {
      const matchesMissed = Math.floor(Math.random() * 3) + 1; // 1 to 3 matches
      injuries.push({ playerId: p.id, matches: matchesMissed });
      p.isInjured = true;
      p.injuryMatchesRemaining = matchesMissed;
    }
  });

  // Calculate Match Statistics
  const totalPossession = homeState.possessionTicks + awayState.possessionTicks || 1;
  const homePossession = Math.round((homeState.possessionTicks / totalPossession) * 100);
  const awayPossession = 100 - homePossession;

  const stats: MatchStats = {
    homeScore: currentHomeScore,
    awayScore: currentAwayScore,
    homeXG: Math.round(homeState.xG * 100) / 100,
    awayXG: Math.round(awayState.xG * 100) / 100,
    homePossession,
    awayPossession,
    homeShots: homeState.shots,
    awayShots: awayState.shots,
    homeShotsOnTarget: homeState.shotsOnTarget,
    awayShotsOnTarget: awayState.shotsOnTarget,
    homeCorners: homeState.corners,
    awayCorners: awayState.corners,
    playerRatings,
    injuries,
  };

  return {
    ...fixture,
    homeScore: currentHomeScore,
    awayScore: currentAwayScore,
    homePenaltyScore,
    awayPenaltyScore,
    isExtraTime,
    isPenalties,
    isFinished: true,
    events,
    stats,
  };
}

function initializeTeamState(manager: LobbyManager): TeamMatchState {
  let starters: PlayerCard[] = [];
  let bench: PlayerCard[] = [];

  // Map squad
  for (const slot of manager.tactics.slots) {
    const card = manager.squad.find((p) => p.id === slot.assignedPlayerId && !p.isInjured);
    if (card) {
      starters.push(card);
    }
  }

  // If squad has fewer than 11 available, populate with 50-rated academy ghost players
  while (starters.length < 11) {
    const missingSlot = manager.tactics.slots[starters.length] || { label: 'CM' as Position };
    const ghost = createAcademyGhostPlayer(missingSlot.label, starters.length);
    starters.push(ghost);
  }

  // Bench
  bench = manager.squad.filter(
    (p) => !starters.some((s) => s.id === p.id) && manager.tactics.benchIds.includes(p.id)
  );

  // Calculate chemistry & effective stats
  const chem = calculateSquadChemistry(starters, manager.tactics);
  const staminaMap: Record<string, number> = {};
  const effectiveStats: Record<string, ReturnType<typeof getEffectiveStats>> = {};

  // Check cumulative fatigue for squads with only 11 players
  const isCumulativeFatigue = manager.squad.length <= 11;

  for (const p of starters) {
    staminaMap[p.id] = p.stamina || 100;
    const pChem = chem.playerChem[p.id] || 0;
    const isOop = chem.outOfPosition[p.id] || false;
    let stats = getEffectiveStats(p, pChem, isOop, staminaMap[p.id]);

    // Apply cumulative fatigue penalty: -15% base attributes
    if (isCumulativeFatigue) {
      stats = {
        pac: Math.round(stats.pac * 0.85),
        sho: Math.round(stats.sho * 0.85),
        pas: Math.round(stats.pas * 0.85),
        dri: Math.round(stats.dri * 0.85),
        def: Math.round(stats.def * 0.85),
        phy: Math.round(stats.phy * 0.85),
      };
    }
    effectiveStats[p.id] = stats;
  }

  return {
    manager,
    starters,
    bench,
    staminaMap,
    effectiveStats,
    isSubbedInAfter60: {},
    score: 0,
    xG: 0,
    shots: 0,
    shotsOnTarget: 0,
    corners: 0,
    possessionTicks: 0,
  };
}

function drainStamina(team: TeamMatchState, minute: number): void {
  const drainRate = 0.85 * 6.4; // 0.85% per minute
  const archetypeMult = team.manager.archetype === 'The Gegenpresser' ? 1.15 : 1.0;

  team.starters.forEach((p) => {
    let current = team.staminaMap[p.id] ?? 100;
    current = Math.max(10, current - drainRate * archetypeMult);
    team.staminaMap[p.id] = current;
    p.stamina = Math.round(current);
  });
}

function evaluateAutoSubs(
  team: TeamMatchState,
  minute: number,
  teamScore: number,
  oppScore: number
): void {
  if (team.bench.length === 0) return;

  for (const rule of team.manager.tactics.autoSubs) {
    if (!rule.enabled) continue;

    if (rule.type === 'STAMINA_BELOW') {
      const threshold = rule.threshold || 35;
      const tiredIdx = team.starters.findIndex(
        (p) => (team.staminaMap[p.id] || 100) < threshold
      );
      if (tiredIdx !== -1 && team.bench.length > 0) {
        const outPlayer = team.starters[tiredIdx];
        const inPlayer = team.bench.shift()!;
        team.starters[tiredIdx] = inPlayer;
        team.staminaMap[inPlayer.id] = 100;
        inPlayer.stamina = 100;
        if (minute >= 60) {
          team.isSubbedInAfter60[inPlayer.id] = true;
        }
      }
    }

    if (rule.type === 'TRAILING_AFTER_70' && minute >= 70 && teamScore < oppScore) {
      // Bring in an attacking forward from bench
      const benchAttackerIdx = team.bench.findIndex(
        (p) => p.primaryPosition === 'ST' || p.primaryPosition === 'LW' || p.primaryPosition === 'RW'
      );
      if (benchAttackerIdx !== -1) {
        // Swap out lowest stamina defender or midfielder
        const lowestStamIdx = team.starters.reduce(
          (lowestIdx, curr, idx, arr) =>
            (team.staminaMap[curr.id] || 100) < (team.staminaMap[arr[lowestIdx].id] || 100)
              ? idx
              : lowestIdx,
          0
        );
        const inPlayer = team.bench.splice(benchAttackerIdx, 1)[0];
        team.starters[lowestStamIdx] = inPlayer;
        team.staminaMap[inPlayer.id] = 100;
        inPlayer.stamina = 100;
        if (minute >= 60) {
          team.isSubbedInAfter60[inPlayer.id] = true;
        }
      }
    }
  }
}

function resolvePossessionCycle(
  cycleIndex: number,
  minute: number,
  att: TeamMatchState,
  def: TeamMatchState,
  attIsHome: boolean,
  currentHomeScore: number,
  currentAwayScore: number,
  ratings: Record<string, number>
): MatchCycleEvent[] {
  const events: MatchCycleEvent[] = [];
  att.possessionTicks += 1;

  const attMids = getMidfielders(att);
  const defMids = getMidfielders(def);

  const attMid = attMids[Math.floor(Math.random() * attMids.length)] || att.starters[0];
  const defMid = defMids[Math.floor(Math.random() * defMids.length)] || def.starters[0];

  // -------------------------------------------------------------
  // PHASE 1: Midfield Build-Up
  // -------------------------------------------------------------
  let tacticalBonus = 0;
  if (att.manager.tactics.playingStyle === 'Tiki-Taka') tacticalBonus += 15;
  if (att.manager.archetype === 'The Architect') tacticalBonus += 8;

  const attScore =
    attMids.reduce((acc, p) => {
      const stats = att.effectiveStats[p.id] || p.stats;
      const stamMod = (att.staminaMap[p.id] || 100) / 100;
      return acc + (stats.pas + stats.dri) * stamMod;
    }, 0) + tacticalBonus;

  const defScore = defMids.reduce((acc, p) => {
    const stats = def.effectiveStats[p.id] || p.stats;
    const stamMod = (def.staminaMap[p.id] || 100) / 100;
    return acc + (stats.def + stats.phy) * stamMod;
  }, 0);

  const pAdvance = Math.max(0.2, Math.min(0.85, attScore / (attScore + defScore)));

  // Coords for 2D radar (Phase 1: Center Midfield)
  const p1Coords = {
    x: 50 + (Math.random() * 20 - 10),
    y: 50 + (Math.random() * 20 - 10),
    ballX: 50,
    ballY: 50,
  };

  if (Math.random() > pAdvance) {
    // Phase 1 Failure -> Turnover / Counter
    ratings[defMid.id] = Math.min(10, (ratings[defMid.id] || 6) + 0.2);
    events.push({
      minute,
      phase: 'BUILD_UP',
      attackingTeamId: att.manager.managerId,
      defendingTeamId: def.manager.managerId,
      attackerPlayerName: attMid.displayName,
      defenderPlayerName: defMid.displayName,
      success: false,
      outcome: 'TURNOVER',
      commentary: `${minute}' — ${defMid.displayName} intercepts ${attMid.displayName}'s pass in midfield!`,
      isDramaticCutIn: false,
      coordinates: p1Coords,
      score: { home: currentHomeScore, away: currentAwayScore },
    });
    return events;
  }

  // Phase 1 Success -> Advance to Phase 2
  events.push({
    minute,
    phase: 'BUILD_UP',
    attackingTeamId: att.manager.managerId,
    defendingTeamId: def.manager.managerId,
    attackerPlayerName: attMid.displayName,
    defenderPlayerName: defMid.displayName,
    success: true,
    outcome: 'ADVANCE',
    commentary: `${minute}' — ${attMid.displayName} orchestrates a sleek build-up play through midfield!`,
    isDramaticCutIn: false,
    coordinates: p1Coords,
    score: { home: currentHomeScore, away: currentAwayScore },
  });

  // -------------------------------------------------------------
  // PHASE 2: Penetration Duel (Attacker vs Defender)
  // -------------------------------------------------------------
  const attackers = getAttackers(att);
  const defenders = getDefenders(def);

  const attacker = attackers[Math.floor(Math.random() * attackers.length)] || att.starters[0];
  const defender = defenders[Math.floor(Math.random() * defenders.length)] || def.starters[0];

  const attStats = att.effectiveStats[attacker.id] || attacker.stats;
  const defStats = def.effectiveStats[defender.id] || defender.stats;

  let attPower = (attStats.pac + attStats.dri) / 2;
  let defPower = (defStats.def + defStats.phy) / 2;

  // PlayStyle & Archetype Perks
  if (attacker.playstyles.includes('Speed Dribbler')) attPower *= 1.15;
  if (att.manager.tactics.playingStyle === 'Fast Counter-Attack') attPower *= 1.2;
  if (def.manager.archetype === 'The Gegenpresser') defPower *= 1.1;

  // Lead protection check (The Catenaccio after min 70)
  const isDefProtectingLead =
    def.manager.archetype === 'The Catenaccio' &&
    minute >= 70 &&
    (attIsHome ? currentAwayScore > currentHomeScore : currentHomeScore > currentAwayScore);

  if (isDefProtectingLead) defPower *= 1.12;

  const pBeatDefender = Math.max(0.2, Math.min(0.85, attPower / (attPower + defPower)));

  // Coords for 2D radar (Phase 2: Final Third)
  const p2Coords = {
    x: attIsHome ? 75 : 25,
    y: 50 + (Math.random() * 30 - 15),
    ballX: attIsHome ? 78 : 22,
    ballY: 50,
  };

  if (Math.random() > pBeatDefender) {
    // Phase 2 Failure -> Defensive Clearance / Tackle
    ratings[defender.id] = Math.min(10, (ratings[defender.id] || 6) + 0.3);
    events.push({
      minute,
      phase: 'PENETRATION',
      attackingTeamId: att.manager.managerId,
      defendingTeamId: def.manager.managerId,
      attackerPlayerName: attacker.displayName,
      defenderPlayerName: defender.displayName,
      success: false,
      outcome: 'CLEARANCE',
      commentary: `${minute}' — Robust challenge! ${defender.displayName} dispossesses ${attacker.displayName} on the edge of the box.`,
      isDramaticCutIn: false,
      coordinates: p2Coords,
      score: { home: currentHomeScore, away: currentAwayScore },
    });
    return events;
  }

  // Phase 2 Success -> Advance to Phase 3
  events.push({
    minute,
    phase: 'PENETRATION',
    attackingTeamId: att.manager.managerId,
    defendingTeamId: def.manager.managerId,
    attackerPlayerName: attacker.displayName,
    defenderPlayerName: defender.displayName,
    success: true,
    outcome: 'ADVANCE',
    commentary: `${minute}' — ${attacker.displayName} surges past ${defender.displayName} with blistering footwork!`,
    isDramaticCutIn: false,
    coordinates: p2Coords,
    score: { home: currentHomeScore, away: currentAwayScore },
  });

  // -------------------------------------------------------------
  // PHASE 3: Finishing Phase (Shot vs Goalkeeper)
  // -------------------------------------------------------------
  att.shots += 1;
  const gk = getGoalkeeper(def);
  const striker = attacker;
  const strikerStats = att.effectiveStats[striker.id] || striker.stats;
  const stamMod = (att.staminaMap[striker.id] || 100) / 100;

  let playStyleBonus = 0;
  if (striker.playstyles.includes('Dead-Ball Specialist')) playStyleBonus += 10;
  if (striker.playstyles.includes('Power Header')) playStyleBonus += 12;

  let shotQuality = strikerStats.sho * stamMod + playStyleBonus;
  let gkResistance = (gk ? gk.ovr : 75) * 1.15;

  if (gk && gk.playstyles.includes('Wall GK')) {
    gkResistance *= 1.3; // +30% 1v1 save bonus
  }

  if (def.manager.tactics.playingStyle === 'Park the Bus') {
    shotQuality *= 0.75;
  }

  // xG increment
  const xgAdded = Math.min(0.8, Math.max(0.08, shotQuality / (shotQuality + gkResistance)));
  att.xG += xgAdded;

  // Coords for 2D radar (Phase 3: Goalmouth / Penalty Box)
  const p3Coords = {
    x: attIsHome ? 92 : 8,
    y: 50,
    ballX: attIsHome ? 98 : 2,
    ballY: 50 + (Math.random() * 16 - 8),
  };

  const roll = Math.random();

  if (roll < xgAdded) {
    // GOAL!
    att.shotsOnTarget += 1;
    if (attIsHome) {
      currentHomeScore += 1;
    } else {
      currentAwayScore += 1;
    }
    ratings[striker.id] = Math.min(10, (ratings[striker.id] || 6) + 1.2);

    events.push({
      minute,
      phase: 'FINISHING',
      attackingTeamId: att.manager.managerId,
      defendingTeamId: def.manager.managerId,
      attackerPlayerName: striker.displayName,
      defenderPlayerName: gk ? gk.displayName : 'Goalkeeper',
      success: true,
      outcome: 'GOAL',
      commentary: `GOAL! ${minute}' — ${striker.displayName} unleashes a venomous strike into the corner! (${currentHomeScore} - ${currentAwayScore})`,
      isDramaticCutIn: true, // Freeze frame cut-in!
      coordinates: p3Coords,
      score: { home: currentHomeScore, away: currentAwayScore },
      goalScorer: striker.displayName,
      assister: attMid.displayName,
    });
  } else if (roll < xgAdded + 0.35) {
    // SAVE by GK
    att.shotsOnTarget += 1;
    if (gk) ratings[gk.id] = Math.min(10, (ratings[gk.id] || 6) + 0.8);

    events.push({
      minute,
      phase: 'FINISHING',
      attackingTeamId: att.manager.managerId,
      defendingTeamId: def.manager.managerId,
      attackerPlayerName: striker.displayName,
      defenderPlayerName: gk ? gk.displayName : 'Goalkeeper',
      success: false,
      outcome: 'SAVE',
      commentary: `${minute}' — SPECTACULAR SAVE! ${gk ? gk.displayName : 'The keeper'} parries ${striker.displayName}'s blistering shot away!`,
      isDramaticCutIn: true,
      coordinates: p3Coords,
      score: { home: currentHomeScore, away: currentAwayScore },
    });
  } else if (roll < xgAdded + 0.55) {
    // CORNER
    att.corners += 1;
    events.push({
      minute,
      phase: 'FINISHING',
      attackingTeamId: att.manager.managerId,
      defendingTeamId: def.manager.managerId,
      attackerPlayerName: striker.displayName,
      defenderPlayerName: defender.displayName,
      success: false,
      outcome: 'CORNER',
      commentary: `${minute}' — Deflected! The shot ricochets out for a corner kick.`,
      isDramaticCutIn: false,
      coordinates: p3Coords,
      score: { home: currentHomeScore, away: currentAwayScore },
    });
  } else {
    // OFF TARGET / BLOCKED
    events.push({
      minute,
      phase: 'FINISHING',
      attackingTeamId: att.manager.managerId,
      defendingTeamId: def.manager.managerId,
      attackerPlayerName: striker.displayName,
      defenderPlayerName: defender.displayName,
      success: false,
      outcome: 'BLOCKED',
      commentary: `${minute}' — Blocked at the death! ${defender.displayName} throws himself in front of ${striker.displayName}'s effort.`,
      isDramaticCutIn: false,
      coordinates: p3Coords,
      score: { home: currentHomeScore, away: currentAwayScore },
    });
  }

  return events;
}

function createGoalEvent(
  minute: number,
  att: TeamMatchState,
  def: TeamMatchState,
  attIsHome: boolean,
  homeScore: number,
  awayScore: number
): MatchCycleEvent {
  const striker = getAttackers(att)[0] || att.starters[0];
  return {
    minute,
    phase: 'FINISHING',
    attackingTeamId: att.manager.managerId,
    defendingTeamId: def.manager.managerId,
    attackerPlayerName: striker.displayName,
    defenderPlayerName: 'GK',
    success: true,
    outcome: 'GOAL',
    commentary: `DRAMATIC GOAL! ${minute}' — ${striker.displayName} scores in the dying embers! (${homeScore} - ${awayScore})`,
    isDramaticCutIn: true,
    coordinates: { x: attIsHome ? 95 : 5, y: 50, ballX: attIsHome ? 98 : 2, ballY: 50 },
    score: { home: homeScore, away: awayScore },
    goalScorer: striker.displayName,
  };
}

function simulatePenalties(): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (let i = 0; i < 5; i++) {
    if (Math.random() < 0.75) home++;
    if (Math.random() < 0.75) away++;
  }
  // Sudden death if tied
  while (home === away) {
    if (Math.random() < 0.7) home++;
    if (Math.random() < 0.7) away++;
  }
  return { home, away };
}

function getMidfielders(team: TeamMatchState): PlayerCard[] {
  const midPositions: Position[] = ['CDM', 'CM', 'CAM', 'LM', 'RM'];
  const res = team.starters.filter((p) => midPositions.includes(p.primaryPosition));
  return res.length > 0 ? res : team.starters.slice(0, 3);
}

function getAttackers(team: TeamMatchState): PlayerCard[] {
  const attPositions: Position[] = ['ST', 'LW', 'RW', 'CAM'];
  const res = team.starters.filter((p) => attPositions.includes(p.primaryPosition));
  return res.length > 0 ? res : team.starters.slice(-2);
}

function getDefenders(team: TeamMatchState): PlayerCard[] {
  const defPositions: Position[] = ['CB', 'LB', 'RB', 'CDM'];
  const res = team.starters.filter((p) => defPositions.includes(p.primaryPosition));
  return res.length > 0 ? res : team.starters.slice(1, 4);
}

function getGoalkeeper(team: TeamMatchState): PlayerCard | undefined {
  return team.starters.find((p) => p.primaryPosition === 'GK') || team.starters[0];
}

function getMidfieldAvg(team: TeamMatchState, statKey: keyof PlayerCard['stats']): number {
  const mids = getMidfielders(team);
  const sum = mids.reduce((acc, p) => acc + (p.stats[statKey] || 70), 0);
  return sum / (mids.length || 1);
}
