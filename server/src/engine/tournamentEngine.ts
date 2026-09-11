// ============================================================================
// Tactaka - Tournament Structures Engine
// ============================================================================

import {
  TournamentFormat,
  TournamentState,
  MatchFixture,
  LeagueTableRow,
  LobbyManager,
} from '../../../shared/types';
import { simulateMatch } from './matchSimulator';

export function createTournament(
  format: TournamentFormat,
  managers: LobbyManager[]
): TournamentState {
  if (format === 'LEAGUE') {
    return initializeLeagueTournament(managers);
  } else if (format === 'WORLD_CUP') {
    return initializeWorldCupTournament(managers);
  } else {
    return initializeUCLTournament(managers);
  }
}

// -------------------------------------------------------------
// Domestic League (Round-Robin)
// -------------------------------------------------------------
function initializeLeagueTournament(managers: LobbyManager[]): TournamentState {
  const managerList = [...managers];
  // If odd number, add a bye or dummy
  const n = managerList.length;
  const fixtures: MatchFixture[] = [];
  let fixtureId = 1;

  // Single round-robin schedule generator
  for (let round = 0; round < n - 1; round++) {
    for (let i = 0; i < Math.floor(n / 2); i++) {
      const homeIdx = (round + i) % (n - 1);
      let awayIdx = (n - 1 - i + round) % (n - 1);
      if (i === 0) awayIdx = n - 1;

      const home = managerList[homeIdx];
      const away = managerList[awayIdx];

      fixtures.push({
        id: `fix-${fixtureId++}`,
        roundNumber: round + 1,
        roundName: `Matchday ${round + 1}`,
        homeTeamId: home.managerId,
        awayTeamId: away.managerId,
        homeTeamName: home.clubName || home.name,
        awayTeamName: away.clubName || away.name,
        isFinished: false,
        events: [],
      });
    }
  }

  // Initial table
  const leagueTable: LeagueTableRow[] = managerList.map((m) => ({
    managerId: m.managerId,
    managerName: m.clubName || m.name,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  }));

  const currentFixtures = fixtures.filter((f) => f.roundNumber === 1);

  return {
    format: 'LEAGUE',
    currentRound: 1,
    totalRounds: n - 1,
    fixtures,
    currentFixtures,
    leagueTable,
    isComplete: false,
  };
}

// -------------------------------------------------------------
// World Cup / Copa System
// -------------------------------------------------------------
function initializeWorldCupTournament(managers: LobbyManager[]): TournamentState {
  const fixtures: MatchFixture[] = [];
  let fixtureId = 1;

  // Group stage: Split into 2 groups (Group A & Group B)
  const groupA = managers.filter((_, idx) => idx % 2 === 0);
  const groupB = managers.filter((_, idx) => idx % 2 === 1);

  // Group A round robin
  for (let i = 0; i < groupA.length; i++) {
    for (let j = i + 1; j < groupA.length; j++) {
      fixtures.push({
        id: `fix-${fixtureId++}`,
        roundNumber: 1,
        roundName: 'Group Stage',
        homeTeamId: groupA[i].managerId,
        awayTeamId: groupA[j].managerId,
        homeTeamName: groupA[i].clubName || groupA[i].name,
        awayTeamName: groupA[j].clubName || groupA[j].name,
        isFinished: false,
        events: [],
      });
    }
  }

  // Group B round robin
  for (let i = 0; i < groupB.length; i++) {
    for (let j = i + 1; j < groupB.length; j++) {
      fixtures.push({
        id: `fix-${fixtureId++}`,
        roundNumber: 1,
        roundName: 'Group Stage',
        homeTeamId: groupB[i].managerId,
        awayTeamId: groupB[j].managerId,
        homeTeamName: groupB[i].clubName || groupB[i].name,
        awayTeamName: groupB[j].clubName || groupB[j].name,
        isFinished: false,
        events: [],
      });
    }
  }

  const leagueTable: LeagueTableRow[] = managers.map((m) => ({
    managerId: m.managerId,
    managerName: m.clubName || m.name,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  }));

  const currentFixtures = fixtures.filter((f) => f.roundNumber === 1);

  return {
    format: 'WORLD_CUP',
    currentRound: 1,
    totalRounds: 3, // Group Stage, Semi-Finals, Grand Final
    fixtures,
    currentFixtures,
    leagueTable,
    knockoutBracket: {},
    isComplete: false,
  };
}

// -------------------------------------------------------------
// UEFA Champions League Format
// -------------------------------------------------------------
function initializeUCLTournament(managers: LobbyManager[]): TournamentState {
  // League Phase: 3 initial rounds, top 4 advance to Semi-Finals (2-legged) and Neutral Grand Final
  const fixtures: MatchFixture[] = [];
  let fixtureId = 1;

  for (let i = 0; i < managers.length; i++) {
    const opp = managers[(i + 1) % managers.length];
    fixtures.push({
      id: `fix-${fixtureId++}`,
      roundNumber: 1,
      roundName: 'League Phase - Match 1',
      homeTeamId: managers[i].managerId,
      awayTeamId: opp.managerId,
      homeTeamName: managers[i].clubName || managers[i].name,
      awayTeamName: opp.clubName || opp.name,
      isFinished: false,
      events: [],
    });
  }

  const leagueTable: LeagueTableRow[] = managers.map((m) => ({
    managerId: m.managerId,
    managerName: m.clubName || m.name,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  }));

  return {
    format: 'CHAMPIONS_LEAGUE',
    currentRound: 1,
    totalRounds: 4, // League Phase, UCL Semis Leg 1, UCL Semis Leg 2, UCL Final
    fixtures,
    currentFixtures: fixtures,
    leagueTable,
    knockoutBracket: {},
    isComplete: false,
  };
}

export function recalculateLeagueTable(
  managers: Record<string, LobbyManager> | LobbyManager[],
  fixtures: MatchFixture[]
): LeagueTableRow[] {
  const managerList = Array.isArray(managers) ? managers : Object.values(managers);
  const tableMap: Record<string, LeagueTableRow> = {};

  for (const m of managerList) {
    tableMap[m.managerId] = {
      managerId: m.managerId,
      managerName: m.clubName || m.name,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    };
  }

  for (const f of fixtures) {
    if (!f.isFinished) continue;
    const home = tableMap[f.homeTeamId];
    const away = tableMap[f.awayTeamId];
    if (!home || !away) continue;

    const hScore = f.homeScore ?? 0;
    const aScore = f.awayScore ?? 0;

    home.played += 1;
    away.played += 1;
    home.goalsFor += hScore;
    home.goalsAgainst += aScore;
    away.goalsFor += aScore;
    away.goalsAgainst += hScore;
    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;

    if (hScore > aScore) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (hScore < aScore) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  return Object.values(tableMap).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });
}

/**
 * Simulates all unfinished fixtures in the current round.
 * Current round is NOT incremented, allowing users to view current round results.
 */
export function simulateCurrentRound(
  tournament: TournamentState,
  managers: Record<string, LobbyManager>
): TournamentState {
  const currentRoundFixtures = tournament.fixtures.filter(
    (f) => f.roundNumber === tournament.currentRound && !f.isFinished
  );

  for (const f of currentRoundFixtures) {
    const homeMgr = managers[f.homeTeamId];
    const awayMgr = managers[f.awayTeamId];
    if (!homeMgr || !awayMgr) continue;

    const simulated = simulateMatch(f, homeMgr, awayMgr);
    Object.assign(f, simulated);
  }

  // Recalculate standings table
  if (tournament.leagueTable) {
    tournament.leagueTable = recalculateLeagueTable(managers, tournament.fixtures);
  }

  // Update currentFixtures to show finished fixtures of this round
  tournament.currentFixtures = tournament.fixtures.filter(
    (f) => f.roundNumber === tournament.currentRound
  );

  // If this is the final round, complete tournament and determine awards
  if (tournament.currentRound >= tournament.totalRounds) {
    tournament.isComplete = true;
    determineAwards(tournament, managers);
  }

  return tournament;
}

/**
 * Advances from the current round to the next round, generating fixtures if needed
 * and simulating them immediately so next matchday results are shown.
 */
export function advanceToNextRound(
  tournament: TournamentState,
  managers: Record<string, LobbyManager>
): TournamentState {
  // Ensure current round is simulated first
  const unsimulated = tournament.fixtures.filter(
    (f) => f.roundNumber === tournament.currentRound && !f.isFinished
  );
  if (unsimulated.length > 0) {
    simulateCurrentRound(tournament, managers);
  }

  if (tournament.currentRound >= tournament.totalRounds) {
    tournament.isComplete = true;
    determineAwards(tournament, managers);
    tournament.currentFixtures = tournament.fixtures.filter(
      (f) => f.roundNumber === tournament.currentRound
    );
    return tournament;
  }

  // Advance round counter
  tournament.currentRound += 1;

  // Generate fixtures if needed (for knockout tournament formats)
  generateNextRoundFixtures(tournament, managers);

  // Simulate this new round's fixtures
  simulateCurrentRound(tournament, managers);

  return tournament;
}

/**
 * Directly skips to the final result by sequentially simulating all remaining rounds.
 */
export function skipToFinalTournament(
  tournament: TournamentState,
  managers: Record<string, LobbyManager>
): TournamentState {
  // Simulate current round if not finished
  const unsimulated = tournament.fixtures.filter(
    (f) => f.roundNumber === tournament.currentRound && !f.isFinished
  );
  if (unsimulated.length > 0) {
    simulateCurrentRound(tournament, managers);
  }

  // Simulate all remaining rounds
  while (tournament.currentRound < tournament.totalRounds) {
    tournament.currentRound += 1;
    generateNextRoundFixtures(tournament, managers);
    simulateCurrentRound(tournament, managers);
  }

  tournament.isComplete = true;
  tournament.currentFixtures = tournament.fixtures.filter(
    (f) => f.roundNumber === tournament.totalRounds
  );
  determineAwards(tournament, managers);

  return tournament;
}

/**
 * Backwards-compatible advance function
 */
export function advanceTournamentRound(
  tournament: TournamentState,
  managers: Record<string, LobbyManager>
): TournamentState {
  const hasUnfinishedCurrent = tournament.fixtures.some(
    (f) => f.roundNumber === tournament.currentRound && !f.isFinished
  );
  if (hasUnfinishedCurrent) {
    return simulateCurrentRound(tournament, managers);
  } else {
    return advanceToNextRound(tournament, managers);
  }
}

function generateNextRoundFixtures(
  tournament: TournamentState,
  managers: Record<string, LobbyManager>
) {
  let fixtureId = tournament.fixtures.length + 1;

  if (tournament.format === 'WORLD_CUP') {
    if (tournament.currentRound === 2 && tournament.leagueTable) {
      // Semi-Finals: Top 4 teams
      const top4 = tournament.leagueTable.slice(0, 4);
      if (top4.length >= 4) {
        tournament.fixtures.push({
          id: `fix-${fixtureId++}`,
          roundNumber: 2,
          roundName: 'Semi-Final 1',
          homeTeamId: top4[0].managerId,
          awayTeamId: top4[3].managerId,
          homeTeamName: top4[0].managerName,
          awayTeamName: top4[3].managerName,
          isFinished: false,
          events: [],
        });
        tournament.fixtures.push({
          id: `fix-${fixtureId++}`,
          roundNumber: 2,
          roundName: 'Semi-Final 2',
          homeTeamId: top4[1].managerId,
          awayTeamId: top4[2].managerId,
          homeTeamName: top4[1].managerName,
          awayTeamName: top4[2].managerName,
          isFinished: false,
          events: [],
        });
      } else if (top4.length >= 2) {
        // Fallback for smaller lobbies: direct final between top 2
        tournament.fixtures.push({
          id: `fix-${fixtureId++}`,
          roundNumber: 2,
          roundName: 'World Cup Grand Final',
          homeTeamId: top4[0].managerId,
          awayTeamId: top4[1].managerId,
          homeTeamName: top4[0].managerName,
          awayTeamName: top4[1].managerName,
          isFinished: false,
          events: [],
        });
        tournament.totalRounds = 2;
      }
    } else if (tournament.currentRound === 3) {
      // Grand Final
      const semis = tournament.fixtures.filter((f) => f.roundNumber === 2);
      if (semis.length >= 2) {
        const winner1 = getMatchWinner(semis[0]);
        const winner2 = getMatchWinner(semis[1]);

        if (winner1 && winner2) {
          tournament.fixtures.push({
            id: `fix-${fixtureId++}`,
            roundNumber: 3,
            roundName: 'World Cup Grand Final',
            homeTeamId: winner1.managerId,
            awayTeamId: winner2.managerId,
            homeTeamName: winner1.name,
            awayTeamName: winner2.name,
            isFinished: false,
            events: [],
          });
        }
      }
    }
  } else if (tournament.format === 'CHAMPIONS_LEAGUE') {
    if (tournament.currentRound === 2 && tournament.leagueTable) {
      // UCL Semis Leg 1
      const top4 = tournament.leagueTable.slice(0, 4);
      if (top4.length >= 4) {
        tournament.fixtures.push({
          id: `fix-${fixtureId++}`,
          roundNumber: 2,
          roundName: 'Semi-Final Leg 1: Match A',
          homeTeamId: top4[0].managerId,
          awayTeamId: top4[3].managerId,
          homeTeamName: top4[0].managerName,
          awayTeamName: top4[3].managerName,
          isFinished: false,
          events: [],
        });
        tournament.fixtures.push({
          id: `fix-${fixtureId++}`,
          roundNumber: 2,
          roundName: 'Semi-Final Leg 1: Match B',
          homeTeamId: top4[1].managerId,
          awayTeamId: top4[2].managerId,
          homeTeamName: top4[1].managerName,
          awayTeamName: top4[2].managerName,
          isFinished: false,
          events: [],
        });
      }
    } else if (tournament.currentRound === 3) {
      // UCL Semis Leg 2 (Return leg)
      const leg1Matches = tournament.fixtures.filter((f) => f.roundNumber === 2);
      for (const leg1 of leg1Matches) {
        tournament.fixtures.push({
          id: `fix-${fixtureId++}`,
          roundNumber: 3,
          roundName: `Return Leg: ${leg1.awayTeamName} vs ${leg1.homeTeamName}`,
          homeTeamId: leg1.awayTeamId,
          awayTeamId: leg1.homeTeamId,
          homeTeamName: leg1.awayTeamName,
          awayTeamName: leg1.homeTeamName,
          isFinished: false,
          events: [],
        });
      }
    } else if (tournament.currentRound === 4) {
      // UCL Neutral Final
      const semisLeg1 = tournament.fixtures.filter((f) => f.roundNumber === 2);
      const semisLeg2 = tournament.fixtures.filter((f) => f.roundNumber === 3);

      const winner1Id = resolveTwoLeggedWinner(semisLeg1[0], semisLeg2[0]);
      const winner2Id = resolveTwoLeggedWinner(semisLeg1[1], semisLeg2[1]);

      const w1 = managers[winner1Id];
      const w2 = managers[winner2Id];

      if (w1 && w2) {
        tournament.fixtures.push({
          id: `fix-${fixtureId++}`,
          roundNumber: 4,
          roundName: 'UEFA Champions League Final',
          homeTeamId: w1.managerId,
          awayTeamId: w2.managerId,
          homeTeamName: w1.name,
          awayTeamName: w2.name,
          isFinished: false,
          events: [],
        });
      }
    }
  }
}

function resolveTwoLeggedWinner(leg1: MatchFixture, leg2: MatchFixture): string {
  // Aggregate
  const team1Score = (leg1.homeScore || 0) + (leg2.awayScore || 0);
  const team2Score = (leg1.awayScore || 0) + (leg2.homeScore || 0);

  if (team1Score > team2Score) return leg1.homeTeamId;
  if (team2Score > team1Score) return leg1.awayTeamId;

  // If tied aggregate, penalty shootout in return leg
  if (leg2.homePenaltyScore !== undefined && leg2.awayPenaltyScore !== undefined) {
    return leg2.homePenaltyScore > leg2.awayPenaltyScore ? leg2.homeTeamId : leg2.awayTeamId;
  }
  return leg1.homeTeamId;
}

function getMatchWinner(fixture?: MatchFixture): { managerId: string; name: string } | null {
  if (!fixture) return null;
  const h = fixture.homeScore || 0;
  const a = fixture.awayScore || 0;
  if (h > a) return { managerId: fixture.homeTeamId, name: fixture.homeTeamName };
  if (a > h) return { managerId: fixture.awayTeamId, name: fixture.awayTeamName };

  if (fixture.homePenaltyScore !== undefined && fixture.awayPenaltyScore !== undefined) {
    if (fixture.homePenaltyScore > fixture.awayPenaltyScore) {
      return { managerId: fixture.homeTeamId, name: fixture.homeTeamName };
    }
    return { managerId: fixture.awayTeamId, name: fixture.awayTeamName };
  }
  return { managerId: fixture.homeTeamId, name: fixture.homeTeamName };
}

function determineAwards(
  tournament: TournamentState,
  managers: Record<string, LobbyManager>
): void {
  // Find Champion
  if (tournament.format === 'LEAGUE' && tournament.leagueTable && tournament.leagueTable.length > 0) {
    tournament.championId = tournament.leagueTable[0].managerId;
  } else {
    const finalMatch = tournament.fixtures.find(
      (f) => f.roundNumber === tournament.totalRounds
    );
    if (finalMatch) {
      const winner = getMatchWinner(finalMatch);
      if (winner) tournament.championId = winner.managerId;
    }
  }

  if (tournament.championId && managers[tournament.championId]) {
    tournament.championName = managers[tournament.championId].clubName || managers[tournament.championId].name;
  }

  // Golden Boot (Top scorer)
  const goalCounts: Record<string, { count: number; managerName: string }> = {};
  const cleanSheetCounts: Record<string, { count: number; managerName: string }> = {};

  for (const f of tournament.fixtures) {
    if (!f.isFinished) continue;
    for (const ev of f.events) {
      if (ev.outcome === 'GOAL' && ev.goalScorer) {
        if (!goalCounts[ev.goalScorer]) {
          const mgr = managers[ev.attackingTeamId];
          goalCounts[ev.goalScorer] = { count: 0, managerName: mgr ? mgr.name : 'FC' };
        }
        goalCounts[ev.goalScorer].count += 1;
      }
    }

    // Clean sheet
    if ((f.awayScore || 0) === 0) {
      const homeMgr = managers[f.homeTeamId];
      if (homeMgr) {
        const gk = homeMgr.squad.find((p) => p.primaryPosition === 'GK')?.displayName || 'Goalkeeper';
        cleanSheetCounts[gk] = cleanSheetCounts[gk] || { count: 0, managerName: homeMgr.name };
        cleanSheetCounts[gk].count += 1;
      }
    }
    if ((f.homeScore || 0) === 0) {
      const awayMgr = managers[f.awayTeamId];
      if (awayMgr) {
        const gk = awayMgr.squad.find((p) => p.primaryPosition === 'GK')?.displayName || 'Goalkeeper';
        cleanSheetCounts[gk] = cleanSheetCounts[gk] || { count: 0, managerName: awayMgr.name };
        cleanSheetCounts[gk].count += 1;
      }
    }
  }

  // Best scorer
  let topScorer = '';
  let maxGoals = 0;
  for (const [name, data] of Object.entries(goalCounts)) {
    if (data.count > maxGoals) {
      maxGoals = data.count;
      topScorer = name;
      tournament.goldenBootWinner = {
        playerName: name,
        managerName: data.managerName,
        goals: data.count,
      };
    }
  }

  // Best GK
  let topGK = '';
  let maxCS = 0;
  for (const [name, data] of Object.entries(cleanSheetCounts)) {
    if (data.count > maxCS) {
      maxCS = data.count;
      topGK = name;
      tournament.goldenGloveWinner = {
        playerName: name,
        managerName: data.managerName,
        cleanSheets: data.count,
      };
    }
  }
}
