// ============================================================================
// Tactaka - Shared Data Models & Types
// ============================================================================

export type PlayerTier = 1 | 2 | 3 | 4; // 1: Legends, 2: Superstars, 3: Rising Stars, 4: Squad Depth

export type Position =
  | 'GK'
  | 'CB'
  | 'LB'
  | 'RB'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'LM'
  | 'RM'
  | 'LW'
  | 'RW'
  | 'ST';

export type TacticalArchetype =
  | 'The Gegenpresser'
  | 'The Architect'
  | 'The Catenaccio'
  | 'The Motivator';

export type FormationType =
  | '4-3-3'
  | '4-2-3-1'
  | '3-5-2'
  | '4-4-2'
  | '5-2-3'
  | '4-1-2-1-2';

export type PlayingStyle =
  | 'Tiki-Taka'
  | 'Fast Counter-Attack'
  | 'Direct Wing Play'
  | 'Park the Bus';

export type PlayStyleTrait =
  | 'Dead-Ball Specialist'
  | 'Speed Dribbler'
  | 'Power Header'
  | 'Wall GK';

export type TournamentFormat =
  | 'LEAGUE'
  | 'WORLD_CUP'
  | 'CHAMPIONS_LEAGUE';

export type RoomPhase =
  | 'LOBBY'
  | 'AUCTION'
  | 'TACTICS'
  | 'TOURNAMENT'
  | 'PODIUM';

export interface PlayerStats {
  pac: number; // Pace
  sho: number; // Shooting
  pas: number; // Passing
  dri: number; // Dribbling
  def: number; // Defending
  phy: number; // Physicality
}

export interface PlayerCard {
  id: string;
  name: string;
  displayName: string;
  tier: PlayerTier;
  ovr: number;
  basePrice: number; // in Millions USD
  primaryPosition: Position;
  secondaryPositions: Position[];
  nation: string;
  club: string;
  era: string; // e.g. "90s Galacticos", "2010s Tiki-Taka", "Modern Era"
  stats: PlayerStats;
  playstyles: PlayStyleTrait[];
  stamina: number; // 0-100%
  isInjured?: boolean;
  injuryMatchesRemaining?: number;
  assignedSlot?: string; // e.g. "pos-0", "bench-1"
  chemPoints?: number; // 0 to 3
  isOutOfPosition?: boolean;
}

export interface ManagerProfile {
  managerId: string;
  name: string;
  clubName?: string;
  avatarUrl: string;
  clubCrest: string;
  level: number;
  xp: number;
  trophiesWon: {
    league: number;
    worldCup: number;
    championsLeague: number;
  };
  record: {
    wins: number;
    losses: number;
    draws: number;
    cleanSheets: number;
    goldenBoots: number;
  };
  archetype: TacticalArchetype;
}

export interface BidEntry {
  managerId: string;
  managerName: string;
  amount: number;
  timestamp: number;
  isAi?: boolean;
}

export interface AuctionState {
  roomCode: string;
  currentCardIndex: number;
  totalCards: number;
  currentCard: PlayerCard | null;
  currentBid: number;
  highestBidderId: string | null;
  highestBidderName: string | null;
  timeRemaining: number; // in seconds
  isClutchActive: boolean;
  bidHistory: BidEntry[];
  unsoldPool: PlayerCard[];
  isClearanceRound: boolean;
  status: 'ACTIVE' | 'CARD_SOLD' | 'CARD_UNSOLD' | 'ROUND_OVER';
}

export interface AutoSubRule {
  id: string;
  enabled: boolean;
  type: 'STAMINA_BELOW' | 'TRAILING_AFTER_70';
  threshold?: number; // e.g. 35 for 35% stamina
  outPlayerId?: string;
  inPlayerId?: string;
}

export interface FormationSlot {
  id: string;
  label: Position;
  x: number; // 0 to 100 on pitch width
  y: number; // 0 to 100 on pitch height (0 is GK, 100 is Striker)
  assignedPlayerId: string | null;
}

export interface TacticsConfig {
  formation: FormationType;
  playingStyle: PlayingStyle;
  slots: FormationSlot[];
  starterIds: string[]; // up to 11 player ids
  benchIds: string[]; // 5-7 bench player ids
  autoSubs: AutoSubRule[];
}

export type MatchPhaseType = 'BUILD_UP' | 'PENETRATION' | 'FINISHING';

export interface MatchCycleEvent {
  minute: number;
  phase: MatchPhaseType;
  attackingTeamId: string;
  defendingTeamId: string;
  attackerPlayerName: string;
  defenderPlayerName: string;
  success: boolean;
  outcome: 'ADVANCE' | 'TURNOVER' | 'CLEARANCE' | 'GOAL' | 'SAVE' | 'CORNER' | 'BLOCKED' | 'FOUL_YELLOW' | 'RED_CARD' | 'INJURY';
  commentary: string;
  isDramaticCutIn: boolean; // triggers dramatic screen freeze & particle burst
  coordinates: {
    x: number; // 0 to 100 pitch
    y: number; // 0 to 100 pitch
    ballX: number;
    ballY: number;
  };
  score: {
    home: number;
    away: number;
  };
  goalScorer?: string;
  assister?: string;
}

export interface MatchStats {
  homeScore: number;
  awayScore: number;
  homeXG: number;
  awayXG: number;
  homePossession: number;
  awayPossession: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeCorners: number;
  awayCorners: number;
  playerRatings: Record<string, number>; // playerId -> 1.0 to 10.0
  injuries: { playerId: string; matches: number }[];
}

export interface MatchFixture {
  id: string;
  roundNumber: number;
  roundName: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore?: number;
  awayScore?: number;
  homePenaltyScore?: number;
  awayPenaltyScore?: number;
  isExtraTime?: boolean;
  isPenalties?: boolean;
  isFinished: boolean;
  events: MatchCycleEvent[];
  stats?: MatchStats;
}

export interface LeagueTableRow {
  managerId: string;
  managerName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface TournamentState {
  format: TournamentFormat;
  currentRound: number;
  totalRounds: number;
  fixtures: MatchFixture[];
  currentFixtures: MatchFixture[];
  leagueTable?: LeagueTableRow[];
  knockoutBracket?: {
    quarterFinals?: MatchFixture[];
    semiFinals?: MatchFixture[];
    final?: MatchFixture;
    thirdPlace?: MatchFixture;
  };
  isComplete: boolean;
  championId?: string;
  championName?: string;
  goldenBootWinner?: {
    playerName: string;
    managerName: string;
    goals: number;
  };
  goldenGloveWinner?: {
    playerName: string;
    managerName: string;
    cleanSheets: number;
  };
}

export interface LobbyManager {
  managerId: string;
  socketId: string;
  name: string;
  clubName?: string;
  avatarUrl: string;
  clubCrest: string;
  archetype: TacticalArchetype;
  isHost: boolean;
  isReady: boolean;
  isAi: boolean;
  purse: number; // Start at 100.0 ($100M)
  squad: PlayerCard[];
  tactics: TacticsConfig;
  level: number;
  xp: number;
}

export interface RoomState {
  roomCode: string;
  hostId: string;
  tournamentFormat: TournamentFormat;
  phase: RoomPhase;
  managers: Record<string, LobbyManager>;
  auction: AuctionState | null;
  tacticsTimeRemaining: number; // 3-min countdown (180s)
  tournament: TournamentState | null;
  createdAt: number;
}
