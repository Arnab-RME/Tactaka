// ============================================================================
// Tactaka - AI Bot Manager (Autonomous Bidding & Tactics Personalities)
// ============================================================================

import { LobbyManager, PlayerCard, TacticalArchetype } from '../../../shared/types';
import { AuctionEngine } from './auctionEngine';
import {
  calculateNextBid,
  canAffordBid,
  STARTING_PURSE,
  CLEARANCE_BASE_PRICE,
} from '../../../shared/constants';
import { autoAssignSquadTactics, createDefaultTactics } from './tacticsEngine';

export type AiPersonality = 'THE_WHALE' | 'VALUE_HUNTER' | 'HOARDER' | 'PRAGMATIST';

export interface AiBotState {
  manager: LobbyManager;
  personality: AiPersonality;
  maxWillingToPay: number;
}

const BOT_NAMES = [
  'Pep AI',
  'Klopp Bot',
  'Ancelotti Prime',
  'Mourinho Special',
  'Sir Alex AI',
  'Zidane Engine',
  'Conte Matrix',
  'Simeone Grit',
];

const BOT_CLUBS = [
  'Manchester Blue FC',
  'Liverpool Red FC',
  'Real Madrid CF',
  'Chelsea Royal FC',
  'United Red FC',
  'Juventus Zebra FC',
  'Spurs North FC',
  'Atletico Stripe FC',
];

const BOT_ARCHETYPES: TacticalArchetype[] = [
  'The Gegenpresser',
  'The Architect',
  'The Catenaccio',
  'The Motivator',
];

const BOT_PERSONALITIES: AiPersonality[] = [
  'THE_WHALE',
  'VALUE_HUNTER',
  'HOARDER',
  'PRAGMATIST',
];

export class AiBotManagerController {
  private bots: Map<string, AiBotState> = new Map();
  private biddingTimeouts: NodeJS.Timeout[] = [];

  public createBot(index: number): LobbyManager {
    const name = BOT_NAMES[index % BOT_NAMES.length];
    const club = BOT_CLUBS[index % BOT_CLUBS.length];
    const archetype = BOT_ARCHETYPES[index % BOT_ARCHETYPES.length];
    const personality = BOT_PERSONALITIES[index % BOT_PERSONALITIES.length];
    const botId = `bot-${index + 1}-${Date.now()}`;

    const manager: LobbyManager = {
      managerId: botId,
      socketId: `socket-ai-${botId}`,
      name: `${name} (AI)`,
      clubName: club,
      avatarUrl: `https://api.dicebear.com/7.x/personas/svg?seed=${name}`,
      clubCrest: ['🦁', '🦅', '⚡', '🏆', '⚓'][index % 5],
      archetype,
      isHost: false,
      isReady: true,
      isAi: true,
      purse: STARTING_PURSE,
      squad: [],
      tactics: createDefaultTactics('4-3-3'),
      level: Math.floor(Math.random() * 5) + 1,
      xp: 250,
    };

    this.bots.set(botId, {
      manager,
      personality,
      maxWillingToPay: 0,
    });

    return manager;
  }

  public getBots(): LobbyManager[] {
    return Array.from(this.bots.values()).map((b) => b.manager);
  }

  public handleCardAuctionUpdate(auctionEngine: AuctionEngine): void {
    const state = auctionEngine.getState();
    if (state.status !== 'ACTIVE' || !state.currentCard) return;

    const card = state.currentCard;

    // Check each bot
    for (const [botId, botState] of this.bots.entries()) {
      if (state.highestBidderId === botId) continue; // Already highest bidder
      if (botState.manager.squad.length >= 24) continue;

      const startingPrice = state.isClearanceRound ? CLEARANCE_BASE_PRICE : card.basePrice;
      const nextBid = calculateNextBid(state.currentBid, startingPrice);

      // Check anti-bankruptcy
      if (!canAffordBid(botState.manager.purse, nextBid, botState.manager.squad.length)) {
        continue;
      }

      // Compute bot willingness to pay based on personality & card tier
      const maxBudget = this.calculateBotMaxBid(botState, card);
      if (nextBid > maxBudget) continue;

      // Add a natural reaction delay (600ms to 2800ms)
      const delay = Math.floor(Math.random() * 2200) + 600;

      // Only schedule if within current remaining time
      if (delay < state.timeRemaining * 1000 - 500) {
        const timeout = setTimeout(() => {
          const currentState = auctionEngine.getState();
          if (
            currentState.status === 'ACTIVE' &&
            currentState.currentCard?.id === card.id &&
            currentState.highestBidderId !== botId
          ) {
            auctionEngine.placeBid(botId, true);
          }
        }, delay);

        this.biddingTimeouts.push(timeout);
      }
    }
  }

  public autoConfigureAllBotTactics(): void {
    for (const botState of this.bots.values()) {
      botState.manager.tactics = autoAssignSquadTactics(botState.manager.squad, '4-3-3');
    }
  }

  public clearAllTimeouts(): void {
    this.biddingTimeouts.forEach((t) => clearTimeout(t));
    this.biddingTimeouts = [];
  }

  private calculateBotMaxBid(botState: AiBotState, card: PlayerCard): number {
    const purse = botState.manager.purse;
    const squadSize = botState.manager.squad.length;

    switch (botState.personality) {
      case 'THE_WHALE':
        if (card.tier === 1) return Math.min(purse * 0.45, 38.0);
        if (card.tier === 2) return Math.min(purse * 0.3, 18.0);
        return card.basePrice + 2.0;

      case 'VALUE_HUNTER':
        if (card.tier === 2) return Math.min(purse * 0.25, 14.0);
        if (card.tier === 3) return Math.min(purse * 0.2, 8.0);
        if (card.tier === 1) return Math.min(purse * 0.25, 15.0);
        return card.basePrice + 1.0;

      case 'HOARDER':
        if (card.tier === 4) return Math.min(purse * 0.15, 4.0);
        if (card.tier === 3) return Math.min(purse * 0.2, 7.0);
        if (card.tier === 2) return Math.min(purse * 0.25, 10.0);
        return card.basePrice;

      case 'PRAGMATIST':
      default:
        // Prioritize missing positions
        const hasPos = botState.manager.squad.some(
          (p) => p.primaryPosition === card.primaryPosition
        );
        const positionMultiplier = hasPos ? 1.0 : 1.4;

        if (card.tier === 1) return Math.min(purse * 0.35, 24.0 * positionMultiplier);
        if (card.tier === 2) return Math.min(purse * 0.25, 12.0 * positionMultiplier);
        if (card.tier === 3) return Math.min(purse * 0.18, 6.0 * positionMultiplier);
        return card.basePrice * positionMultiplier;
    }
  }
}
