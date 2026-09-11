// ============================================================================
// Tactaka - Authoritative Live Auction Engine & State Machine
// ============================================================================

import { AuctionState, PlayerCard, LobbyManager, BidEntry } from '../../../shared/types';
import {
  AUCTION_BASE_COUNTDOWN,
  AUCTION_CLEARANCE_COUNTDOWN,
  CLEARANCE_BASE_PRICE,
  AUCTION_CLUTCH_THRESHOLD,
  AUCTION_CLUTCH_RESET_TIME,
  calculateNextBid,
  canAffordBid,
  MAX_SQUAD_SIZE,
} from '../../../shared/constants';

export class AuctionEngine {
  private state: AuctionState;
  private cardPool: PlayerCard[];
  private managers: Record<string, LobbyManager>;
  private timerInterval: NodeJS.Timeout | null = null;
  private onStateUpdate: (state: AuctionState) => void;
  private onCardResolved: (card: PlayerCard, winnerId: string | null, finalPrice: number) => void;
  private onAuctionFinished: () => void;

  constructor(
    roomCode: string,
    pool: PlayerCard[],
    managers: Record<string, LobbyManager>,
    callbacks: {
      onStateUpdate: (state: AuctionState) => void;
      onCardResolved: (card: PlayerCard, winnerId: string | null, finalPrice: number) => void;
      onAuctionFinished: () => void;
    }
  ) {
    this.cardPool = [...pool];
    this.managers = managers;
    this.onStateUpdate = callbacks.onStateUpdate;
    this.onCardResolved = callbacks.onCardResolved;
    this.onAuctionFinished = callbacks.onAuctionFinished;

    this.state = {
      roomCode,
      currentCardIndex: 0,
      totalCards: pool.length,
      currentCard: pool[0] || null,
      currentBid: 0,
      highestBidderId: null,
      highestBidderName: null,
      timeRemaining: AUCTION_BASE_COUNTDOWN,
      isClutchActive: false,
      bidHistory: [],
      unsoldPool: [],
      isClearanceRound: false,
      status: 'ACTIVE',
    };
  }

  public getState(): AuctionState {
    return { ...this.state };
  }

  public start(): void {
    if (this.cardPool.length === 0) {
      this.onAuctionFinished();
      return;
    }
    this.loadCard(0);
    this.startAuthoritativeTimer();
  }

  public stop(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Processes a bid from a manager with strict anti-bankruptcy and anti-cheat validation.
   */
  public placeBid(
    managerId: string,
    isAi: boolean = false
  ): { success: boolean; error?: string; nextBid?: number } {
    if (this.state.status !== 'ACTIVE') {
      return { success: false, error: 'Auction is not accepting bids right now' };
    }

    const manager = this.managers[managerId];
    if (!manager) {
      return { success: false, error: 'Manager not found in lobby' };
    }

    if (manager.squad.length >= MAX_SQUAD_SIZE) {
      return { success: false, error: 'Max squad size (24) reached' };
    }

    if (this.state.highestBidderId === managerId) {
      return { success: false, error: 'You already hold the highest bid' };
    }

    const card = this.state.currentCard;
    if (!card) {
      return { success: false, error: 'No active card on auction' };
    }

    // Calculate required next bid ($0.5M starting price in clearance round)
    const startingPrice = this.state.isClearanceRound ? CLEARANCE_BASE_PRICE : card.basePrice;
    const requiredBid = calculateNextBid(this.state.currentBid, startingPrice);

    // Anti-bankruptcy guardrail check:
    // Purse - Bid Amount >= (Mandatory Unfilled Slots to reach 11) * $0.5M
    const canAfford = canAffordBid(manager.purse, requiredBid, manager.squad.length);
    if (!canAfford) {
      return {
        success: false,
        error: `Anti-Bankruptcy Guardrail: Insufficient purse reserve for mandatory 11-man squad!`,
      };
    }

    // Accept bid
    this.state.currentBid = requiredBid;
    this.state.highestBidderId = managerId;
    this.state.highestBidderName = manager.name;

    const bidEntry: BidEntry = {
      managerId,
      managerName: manager.name,
      amount: requiredBid,
      timestamp: Date.now(),
      isAi,
    };
    this.state.bidHistory.unshift(bidEntry);

    // Clutch Rule: Any bid placed with <= 4 seconds remaining resets the countdown clock to 5 seconds
    if (this.state.timeRemaining <= AUCTION_CLUTCH_THRESHOLD) {
      this.state.timeRemaining = AUCTION_CLUTCH_RESET_TIME;
      this.state.isClutchActive = true;
    }

    this.onStateUpdate(this.getState());
    return { success: true, nextBid: requiredBid };
  }

  private loadCard(index: number): void {
    const card = this.cardPool[index] || null;
    this.state.currentCardIndex = index;
    this.state.currentCard = card;
    this.state.currentBid = 0;
    this.state.highestBidderId = null;
    this.state.highestBidderName = null;
    this.state.timeRemaining = this.state.isClearanceRound
      ? AUCTION_CLEARANCE_COUNTDOWN
      : AUCTION_BASE_COUNTDOWN;
    this.state.isClutchActive = false;
    this.state.bidHistory = [];
    this.state.status = 'ACTIVE';

    this.onStateUpdate(this.getState());
  }

  private startAuthoritativeTimer(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      if (this.state.status !== 'ACTIVE') return;

      this.state.timeRemaining -= 1;

      // Check if clutch threshold reached
      if (this.state.timeRemaining <= AUCTION_CLUTCH_THRESHOLD && !this.state.isClutchActive) {
        this.state.isClutchActive = true;
      }

      // Time expired
      if (this.state.timeRemaining <= 0) {
        this.resolveCurrentCard();
      } else {
        this.onStateUpdate(this.getState());
      }
    }, 1000);
  }

  private resolveCurrentCard(): void {
    const card = this.state.currentCard;
    if (!card) return;

    if (this.state.highestBidderId) {
      // SOLD
      this.state.status = 'CARD_SOLD';
      const winner = this.managers[this.state.highestBidderId];
      if (winner) {
        winner.purse = Math.round((winner.purse - this.state.currentBid) * 10) / 10;
        winner.squad.push({ ...card });
      }

      this.onCardResolved(card, this.state.highestBidderId, this.state.currentBid);
    } else {
      // UNSOLD: queue for sudden-death clearance round if not already in clearance
      this.state.status = 'CARD_UNSOLD';
      if (!this.state.isClearanceRound) {
        this.state.unsoldPool.push(card);
      }
      this.onCardResolved(card, null, 0);
    }

    this.onStateUpdate(this.getState());

    // Pause briefly (1.5s) to display SOLD / UNSOLD animation, then load next card
    setTimeout(() => {
      this.advanceToNextCard();
    }, 1500);
  }

  private advanceToNextCard(): void {
    const nextIdx = this.state.currentCardIndex + 1;

    if (nextIdx < this.cardPool.length) {
      this.loadCard(nextIdx);
    } else if (this.state.unsoldPool.length > 0 && !this.state.isClearanceRound) {
      // Start sudden-death clearance round: all unsold cards start at $0.5M with 10s countdown
      this.state.isClearanceRound = true;
      this.cardPool = this.state.unsoldPool.map((c) => ({
        ...c,
        basePrice: CLEARANCE_BASE_PRICE,
      }));
      this.state.totalCards = this.cardPool.length;
      this.state.unsoldPool = [];
      this.loadCard(0);
    } else {
      // Auction completely finished
      this.state.status = 'ROUND_OVER';
      this.stop();
      this.onStateUpdate(this.getState());
      this.onAuctionFinished();
    }
  }
}
