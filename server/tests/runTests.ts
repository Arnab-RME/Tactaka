// ============================================================================
// Tactaka - Server Unit & Mathematical Logic Verification Tests
// ============================================================================

import {
  calculateNextBid,
  canAffordBid,
  getXPForLevel,
  calculateLevelFromXP,
  AUCTION_CLEARANCE_COUNTDOWN,
  CLEARANCE_BASE_PRICE,
} from '../../shared/constants';
import { calculateSquadChemistry, getEffectiveStats } from '../src/engine/chemistryEngine';
import { simulateMatch } from '../src/engine/matchSimulator';
import { MASTER_PLAYER_DATABASE } from '../src/playerDatabase';
import { createDefaultTactics } from '../src/engine/tacticsEngine';
import { LobbyManager, MatchFixture } from '../../shared/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('--- RUNNING TACTAKA MATHEMATICAL & RULE TESTS ---\n');

// 1. Dynamic Escalation Math Tests
console.log('[1] Testing Dynamic Escalation Math:');
assert(calculateNextBid(0, 5.0) === 5.0, 'Base price bid for initial 0 bid is $5.0M');
assert(calculateNextBid(3.0, 1.5) === 3.5, 'Under $5M increments by +$0.5M ($3.0M -> $3.5M)');
assert(calculateNextBid(5.0, 5.0) === 6.0, '$5.0M to $20.0M increments by +$1.0M ($5.0M -> $6.0M)');
assert(calculateNextBid(19.0, 5.0) === 20.0, '$19.0M -> $20.0M');
assert(calculateNextBid(20.0, 5.0) === 22.0, '$20.0M to $40.0M increments by +$2.0M ($20.0M -> $22.0M)');
assert(calculateNextBid(38.0, 5.0) === 40.0, '$38.0M -> $40.0M');
assert(calculateNextBid(40.0, 5.0) === 45.0, '$40.0M+ increments by +$5.0M ($40.0M -> $45.0M)');
assert(calculateNextBid(65.0, 5.0) === 70.0, '$65.0M -> $70.0M');
// Clearance round tests
assert(CLEARANCE_BASE_PRICE === 0.5, 'Clearance base price is $0.5M');
assert(AUCTION_CLEARANCE_COUNTDOWN === 10, 'Clearance countdown timer is 10s');
assert(calculateNextBid(0, CLEARANCE_BASE_PRICE) === 0.5, 'First bid in clearance round starts at $0.5M');
assert(calculateNextBid(0.5, CLEARANCE_BASE_PRICE) === 1.0, 'Subsequent bid in clearance increments to $1.0M');

// AuctionEngine clearance round lifecycle integration test
console.log('\n[1b] Testing AuctionEngine Clearance Round Lifecycle:');
const testManagers: Record<string, LobbyManager> = {
  'mgr-1': {
    managerId: 'mgr-1',
    socketId: 'sock-1',
    name: 'Manager 1',
    avatarUrl: '',
    clubCrest: '🔴',
    archetype: 'The Architect',
    isHost: true,
    isReady: true,
    isAi: false,
    purse: 100.0,
    squad: [],
    tactics: createDefaultTactics('4-3-3'),
    level: 1,
    xp: 0,
  },
  'mgr-2': {
    managerId: 'mgr-2',
    socketId: 'sock-2',
    name: 'Manager 2',
    avatarUrl: '',
    clubCrest: '🔵',
    archetype: 'The Gegenpresser',
    isHost: false,
    isReady: true,
    isAi: false,
    purse: 100.0,
    squad: [],
    tactics: createDefaultTactics('4-3-3'),
    level: 1,
    xp: 0,
  },
};

const sampleCard = { ...MASTER_PLAYER_DATABASE[0], basePrice: 15.0 };
const engine = new (require('../src/engine/auctionEngine').AuctionEngine)(
  'ROOM1',
  [sampleCard],
  testManagers,
  {
    onStateUpdate: () => {},
    onCardResolved: () => {},
    onAuctionFinished: () => {},
  }
);

engine.start();
const initialState = engine.getState();
assert(initialState.timeRemaining === 12, 'Regular round starts with 12s countdown');
assert(initialState.isClearanceRound === false, 'Starts in regular round');

// Resolve card as unsold
(engine as any).resolveCurrentCard();
assert((engine as any).state.unsoldPool.length === 1, 'Unsold card added to clearance queue');

// Advance to clearance round
(engine as any).advanceToNextCard();
const clearanceState = engine.getState();
assert(clearanceState.isClearanceRound === true, 'Successfully transitioned into clearance round');
assert(clearanceState.timeRemaining === 10, 'Clearance round starts with exactly 10s countdown');
assert(clearanceState.currentCard?.basePrice === 0.5, 'Clearance card base price is set to $0.5M');

// Place first bid in clearance round
const bid1 = engine.placeBid('mgr-1');
assert(bid1.success === true, 'Manager 1 placed first clearance bid');
assert(bid1.nextBid === 0.5, 'First bid amount is exactly $0.5M');
assert(engine.getState().currentBid === 0.5, 'Current bid updated to $0.5M');

// Place second bid in clearance round
const bid2 = engine.placeBid('mgr-2');
assert(bid2.success === true, 'Manager 2 placed second clearance bid');
assert(bid2.nextBid === 1.0, 'Second bid amount increments to $1.0M');
assert(engine.getState().currentBid === 1.0, 'Current bid updated to $1.0M');

engine.stop();
console.log('✅ PASSED: AuctionEngine clearance round lifecycle validated (10s clock & $0.5M starting price)');

// 2. Anti-Bankruptcy Guardrail Tests
console.log('\n[2] Testing Anti-Bankruptcy Guardrail:');
// Purse 100M, squad 0 players. Next squad count will be 1. Mandatory unfilled to 11 is 10 slots.
// Reserve needed = 10 * $0.5M = $5.0M.
assert(canAffordBid(100.0, 95.0, 0) === true, 'Purse 100M, 0 squad, bid 95M leaves exactly 5.0M reserve');
assert(canAffordBid(100.0, 95.1, 0) === false, 'Purse 100M, 0 squad, bid 95.1M leaves <5.0M reserve -> BLOCKED');
// If squad already has 10 players, mandatory unfilled is 0. Reserve needed is $0.
assert(canAffordBid(10.0, 10.0, 10) === true, 'Squad has 10 players, 11th player can spend all remaining funds');

// 3. Manager Level Progression Formula Tests
// Formula: XP required for Level N = 500 * (N^1.5)
console.log('\n[3] Testing Level Progression Formulas:');
const xpLvl2 = getXPForLevel(2);
const xpLvl3 = getXPForLevel(3);
assert(xpLvl2 === Math.floor(500 * Math.pow(2, 1.5)), `Level 2 requires ${xpLvl2} XP`);
assert(xpLvl3 === Math.floor(500 * Math.pow(3, 1.5)), `Level 3 requires ${xpLvl3} XP`);
assert(calculateLevelFromXP(0) === 1, '0 XP = Level 1');
assert(calculateLevelFromXP(xpLvl2) === 2, `${xpLvl2} XP = Level 2`);
assert(calculateLevelFromXP(xpLvl3) === 3, `${xpLvl3} XP = Level 3`);

// 4. Chemistry Engine Tests
console.log('\n[4] Testing Chemistry Engine:');
const brazilPlayers = MASTER_PLAYER_DATABASE.filter((p) => p.nation === 'Brazil').slice(0, 6);
const tactics = createDefaultTactics('4-3-3');
tactics.slots.forEach((s, idx) => {
  if (brazilPlayers[idx]) {
    s.assignedPlayerId = brazilPlayers[idx].id;
  }
});
const chemRes = calculateSquadChemistry(brazilPlayers, tactics);
assert(chemRes.nationCounts['Brazil'] === 6, 'Detected 6 Brazilian players');
assert(chemRes.playerChem[brazilPlayers[0].id] === 3, '6+ same nation yields maximum +3 Chemistry');

const effectiveStats = getEffectiveStats(brazilPlayers[0], 3, false, 100);
assert(
  effectiveStats.pac === Math.min(99, brazilPlayers[0].stats.pac + 6),
  '3 Chem points yields +6 to face stats'
);

const oopStats = getEffectiveStats(brazilPlayers[0], 0, true, 100);
assert(
  oopStats.pac === Math.round(brazilPlayers[0].stats.pac * 0.7),
  'Out of position incurs -30% stat penalty'
);

// 5. Match Simulator 14-Cycle Duel Test
console.log('\n[5] Testing 14-Cycle Match Simulator:');
const mockManagerA: LobbyManager = {
  managerId: 'mgr-a',
  socketId: 'sock-a',
  name: 'FC Barcelona',
  avatarUrl: '',
  clubCrest: '🔴🔵',
  archetype: 'The Architect',
  isHost: true,
  isReady: true,
  isAi: false,
  purse: 20,
  squad: MASTER_PLAYER_DATABASE.slice(0, 16),
  tactics: createDefaultTactics('4-3-3'),
  level: 1,
  xp: 0,
};
mockManagerA.tactics.slots.forEach((s, idx) => {
  s.assignedPlayerId = mockManagerA.squad[idx].id;
});

const mockManagerB: LobbyManager = {
  managerId: 'mgr-b',
  socketId: 'sock-b',
  name: 'Real Madrid',
  avatarUrl: '',
  clubCrest: '⚪',
  archetype: 'The Gegenpresser',
  isHost: false,
  isReady: true,
  isAi: true,
  purse: 20,
  squad: MASTER_PLAYER_DATABASE.slice(16, 32),
  tactics: createDefaultTactics('4-3-3'),
  level: 1,
  xp: 0,
};
mockManagerB.tactics.slots.forEach((s, idx) => {
  s.assignedPlayerId = mockManagerB.squad[idx].id;
});

const fixture: MatchFixture = {
  id: 'test-fix-1',
  roundNumber: 1,
  roundName: 'Test Match',
  homeTeamId: 'mgr-a',
  awayTeamId: 'mgr-b',
  homeTeamName: 'FC Barcelona',
  awayTeamName: 'Real Madrid',
  isFinished: false,
  events: [],
};

const result = simulateMatch(fixture, mockManagerA, mockManagerB);
assert(result.isFinished === true, 'Match finished successfully');
assert(result.events.length >= 14, `Generated ${result.events.length} match cycle events`);
assert(result.stats !== undefined, 'Match statistics populated');
assert(
  result.stats!.homePossession + result.stats!.awayPossession === 100,
  'Total possession equals 100%'
);
console.log(
  `Simulated Result: ${result.homeTeamName} ${result.homeScore} - ${result.awayScore} ${result.awayTeamName} (xG: ${result.stats?.homeXG} vs ${result.stats?.awayXG})`
);

console.log('\n🎉 ALL MATHEMATICAL & LOGICAL TESTS PASSED PERFECTLY!\n');
