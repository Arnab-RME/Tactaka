// ============================================================================
// Tactaka - Room & Lobby Lifecycle Manager
// ============================================================================

import {
  RoomState,
  RoomPhase,
  TournamentFormat,
  LobbyManager,
  TacticsConfig,
  PlayerCard,
} from '../../../shared/types';
import {
  STARTING_PURSE,
  TACTICS_LOCKDOWN_SECONDS,
  MIN_SQUAD_SIZE,
} from '../../../shared/constants';
import { generateAuctionPool } from '../playerDatabase';
import { AuctionEngine } from './auctionEngine';
import { AiBotManagerController } from './aiBotManager';
import {
  createTournament,
  advanceTournamentRound,
  simulateCurrentRound,
  advanceToNextRound,
  skipToFinalTournament,
} from './tournamentEngine';
import { createDefaultTactics, autoAssignSquadTactics } from './tacticsEngine';
import { recordMatchOutcome, recordTrophyWin } from './progressionEngine';

export class Room {
  public state: RoomState;
  public auctionEngine: AuctionEngine | null = null;
  public aiController: AiBotManagerController = new AiBotManagerController();
  private tacticsTimer: NodeJS.Timeout | null = null;
  private careerAwarded: boolean = false;
  private onBroadcast: (event: string, payload: any) => void;

  constructor(
    roomCode: string,
    hostManager: LobbyManager,
    onBroadcast: (event: string, payload: any) => void
  ) {
    this.onBroadcast = onBroadcast;

    this.state = {
      roomCode,
      hostId: hostManager.managerId,
      tournamentFormat: 'LEAGUE',
      phase: 'LOBBY',
      managers: {
        [hostManager.managerId]: hostManager,
      },
      auction: null,
      tacticsTimeRemaining: TACTICS_LOCKDOWN_SECONDS,
      tournament: null,
      createdAt: Date.now(),
    };
  }

  public addManager(manager: LobbyManager): boolean {
    const currentCount = Object.keys(this.state.managers).length;
    if (currentCount >= 12) return false;

    this.state.managers[manager.managerId] = manager;
    this.broadcastState();
    return true;
  }

  public addAiBot(): LobbyManager | null {
    const currentCount = Object.keys(this.state.managers).length;
    if (currentCount >= 12) return null;

    const bot = this.aiController.createBot(currentCount);
    this.state.managers[bot.managerId] = bot;
    this.broadcastState();
    return bot;
  }

  public autoFillBots(targetCount: number = 4): void {
    let currentCount = Object.keys(this.state.managers).length;
    while (currentCount < targetCount && currentCount < 12) {
      const bot = this.aiController.createBot(currentCount);
      this.state.managers[bot.managerId] = bot;
      currentCount++;
    }
    this.broadcastState();
  }

  public setTournamentFormat(format: TournamentFormat): void {
    if (this.state.phase === 'LOBBY') {
      this.state.tournamentFormat = format;
      this.broadcastState();
    }
  }

  public updateManagerTactics(managerId: string, tactics: TacticsConfig): void {
    const mgr = this.state.managers[managerId];
    if (mgr) {
      mgr.tactics = tactics;
      this.broadcastState();
    }
  }

  public toggleManagerReady(managerId: string): void {
    const mgr = this.state.managers[managerId];
    if (mgr) {
      mgr.isReady = !mgr.isReady;
      this.broadcastState();
    }
  }

  // -------------------------------------------------------------
  // Phase 1 -> 2: Start Auction
  // -------------------------------------------------------------
  public startAuction(): { success: boolean; error?: string } {
    const managerCount = Object.keys(this.state.managers).length;
    if (managerCount < 1) {
      return { success: false, error: 'Minimum 1 manager required' };
    }

    this.state.phase = 'AUCTION';

    // Generate scaled card pool: N managers * 15 cards
    const pool = generateAuctionPool(managerCount);

    this.auctionEngine = new AuctionEngine(
      this.state.roomCode,
      pool,
      this.state.managers,
      {
        onStateUpdate: (auctionState) => {
          this.state.auction = auctionState;
          this.onBroadcast('auction_update', {
            auctionState,
            managers: this.state.managers,
          });
          if (auctionState.status === 'CARD_SOLD') {
            this.broadcastState();
          }
          // Notify AI bots of updates
          if (this.auctionEngine) {
            this.aiController.handleCardAuctionUpdate(this.auctionEngine);
          }
        },
        onCardResolved: (card, winnerId, finalPrice) => {
          this.broadcastState();
          this.onBroadcast('card_resolved', {
            card,
            winnerId,
            winnerName: winnerId ? this.state.managers[winnerId]?.name : null,
            finalPrice,
            managers: this.state.managers,
          });
        },
        onAuctionFinished: () => {
          this.startTacticalLockdown();
        },
      }
    );

    this.auctionEngine.start();
    this.broadcastState();
    return { success: true };
  }

  public skipToTactics(): void {
    if (this.auctionEngine) {
      this.auctionEngine.stop();
    }
    const { MASTER_PLAYER_DATABASE } = require('../playerDatabase');
    Object.values(this.state.managers).forEach((mgr, idx) => {
      if (mgr.squad.length === 0) {
        mgr.squad = MASTER_PLAYER_DATABASE.slice(idx * 16, idx * 16 + 16);
      }
    });
    this.startTacticalLockdown();
  }

  // -------------------------------------------------------------
  // Phase 2 -> 3: Tactical Lockdown
  // -------------------------------------------------------------
  public startTacticalLockdown(): void {
    this.state.phase = 'TACTICS';
    this.state.tacticsTimeRemaining = TACTICS_LOCKDOWN_SECONDS;

    // Auto-configure tactics for AI bots
    this.aiController.autoConfigureAllBotTactics();

    // Also auto-assign initial starter slots for human managers so they have a valid pitch ready
    Object.values(this.state.managers).forEach((mgr) => {
      if (!mgr.isAi && mgr.tactics.starterIds.length === 0) {
        mgr.tactics = autoAssignSquadTactics(mgr.squad, mgr.tactics.formation);
      }
    });

    this.broadcastState();

    // Start 180s authoritative countdown
    if (this.tacticsTimer) clearInterval(this.tacticsTimer);
    this.tacticsTimer = setInterval(() => {
      this.state.tacticsTimeRemaining -= 1;
      this.onBroadcast('tactics_timer', { remaining: this.state.tacticsTimeRemaining });

      if (this.state.tacticsTimeRemaining <= 0) {
        this.finishTacticalLockdown();
      }
    }, 1000);
  }

  public finishTacticalLockdown(): void {
    if (this.tacticsTimer) {
      clearInterval(this.tacticsTimer);
      this.tacticsTimer = null;
    }
    this.startTournament();
  }

  // -------------------------------------------------------------
  // Phase 3 -> 4: Tournament Simulation
  // -------------------------------------------------------------
  public startTournament(): void {
    this.state.phase = 'TOURNAMENT';
    this.careerAwarded = false;

    const managerList = Object.values(this.state.managers);
    this.state.tournament = createTournament(this.state.tournamentFormat, managerList);
    this.broadcastState();
  }

  public simulateMatchday(): void {
    if (!this.state.tournament || this.state.phase !== 'TOURNAMENT') return;

    const hasUnfinishedCurrent = this.state.tournament.fixtures.some(
      (f) => f.roundNumber === this.state.tournament!.currentRound && !f.isFinished
    );

    if (hasUnfinishedCurrent) {
      this.state.tournament = simulateCurrentRound(this.state.tournament, this.state.managers);
    } else {
      this.state.tournament = advanceToNextRound(this.state.tournament, this.state.managers);
    }

    if (this.state.tournament.isComplete) {
      this.awardCareerProgression();
    }

    this.broadcastState();
  }

  public skipToFinal(): void {
    if (!this.state.tournament || this.state.phase !== 'TOURNAMENT') return;

    this.state.tournament = skipToFinalTournament(this.state.tournament, this.state.managers);
    this.awardCareerProgression();
    this.broadcastState();
  }

  public finishToPodium(): void {
    if (!this.state.tournament) return;
    this.state.phase = 'PODIUM';
    this.broadcastState();
  }

  public advanceRound(): void {
    this.simulateMatchday();
  }

  private awardCareerProgression(): void {
    if (!this.state.tournament || this.careerAwarded) return;
    this.careerAwarded = true;
    const champId = this.state.tournament.championId;

    for (const mgr of Object.values(this.state.managers)) {
      if (mgr.isAi) continue;

      const isChamp = mgr.managerId === champId;
      if (isChamp) {
        recordTrophyWin(mgr as any, this.state.tournamentFormat);
      }
    }
  }

  public broadcastState(): void {
    this.onBroadcast('room_state', this.state);
  }

  public destroy(): void {
    if (this.auctionEngine) this.auctionEngine.stop();
    if (this.tacticsTimer) clearInterval(this.tacticsTimer);
    this.aiController.clearAllTimeouts();
  }
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private socketToManager: Map<string, { roomCode: string; managerId: string }> = new Map();

  public createRoom(
    hostProfile: Partial<LobbyManager>,
    socketId: string,
    onBroadcast: (roomCode: string, event: string, payload: any) => void
  ): Room {
    const roomCode = this.generateUniquePin();

    const hostManager: LobbyManager = {
      managerId: hostProfile.managerId || `mgr-${Date.now()}`,
      socketId,
      name: hostProfile.name || 'Host Manager',
      clubName: hostProfile.clubName || 'Thunderbolts FC',
      avatarUrl: hostProfile.avatarUrl || `https://api.dicebear.com/7.x/personas/svg?seed=Host`,
      clubCrest: hostProfile.clubCrest || '⚡',
      archetype: hostProfile.archetype || 'The Gegenpresser',
      isHost: true,
      isReady: true,
      isAi: false,
      purse: STARTING_PURSE,
      squad: [],
      tactics: createDefaultTactics('4-3-3'),
      level: hostProfile.level || 1,
      xp: hostProfile.xp || 0,
    };

    const room = new Room(roomCode, hostManager, (event, payload) => {
      onBroadcast(roomCode, event, payload);
    });

    this.rooms.set(roomCode, room);
    this.socketToManager.set(socketId, { roomCode, managerId: hostManager.managerId });

    return room;
  }

  public joinRoom(
    roomCode: string,
    profile: Partial<LobbyManager>,
    socketId: string
  ): { room: Room | null; manager: LobbyManager | null; error?: string } {
    const code = roomCode.toUpperCase().trim();
    const room = this.rooms.get(code);
    if (!room) {
      return { room: null, manager: null, error: 'Room PIN not found' };
    }

    if (room.state.phase !== 'LOBBY') {
      // Reconnect check
      if (profile.managerId && room.state.managers[profile.managerId]) {
        const existing = room.state.managers[profile.managerId];
        existing.socketId = socketId;
        this.socketToManager.set(socketId, { roomCode: code, managerId: existing.managerId });
        return { room, manager: existing };
      }
      return { room: null, manager: null, error: 'Room has already started' };
    }

    const newManager: LobbyManager = {
      managerId: profile.managerId || `mgr-${Date.now()}`,
      socketId,
      name: profile.name || `Manager ${Object.keys(room.state.managers).length + 1}`,
      clubName: profile.clubName || `${profile.name || 'FC'} Club`,
      avatarUrl: profile.avatarUrl || `https://api.dicebear.com/7.x/personas/svg?seed=${Date.now()}`,
      clubCrest: profile.clubCrest || '⚽',
      archetype: profile.archetype || 'The Architect',
      isHost: false,
      isReady: false,
      isAi: false,
      purse: STARTING_PURSE,
      squad: [],
      tactics: createDefaultTactics('4-3-3'),
      level: profile.level || 1,
      xp: profile.xp || 0,
    };

    const added = room.addManager(newManager);
    if (!added) {
      return { room: null, manager: null, error: 'Room is full (max 12 managers)' };
    }

    this.socketToManager.set(socketId, { roomCode: code, managerId: newManager.managerId });
    return { room, manager: newManager };
  }

  public getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode.toUpperCase().trim());
  }

  public getManagerSession(socketId: string): { roomCode: string; managerId: string } | undefined {
    return this.socketToManager.get(socketId);
  }

  public rebindSocket(socketId: string, roomCode: string, managerId: string): void {
    this.socketToManager.set(socketId, { roomCode: roomCode.toUpperCase().trim(), managerId });
  }

  public handleDisconnect(socketId: string): void {
    const session = this.socketToManager.get(socketId);
    if (session) {
      this.socketToManager.delete(socketId);
      // We retain manager in room for auto-reconnect!
    }
  }

  private generateUniquePin(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pin = '';
    do {
      pin = '';
      for (let i = 0; i < 6; i++) {
        pin += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(pin));
    return pin;
  }
}
