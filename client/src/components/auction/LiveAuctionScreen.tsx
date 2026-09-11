// ============================================================================
// Tactaka - Live Tiered Auction Screen & Central Action Disc
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { AuctionState, LobbyManager, PlayerCard } from '../../../../shared/types';
import {
  calculateNextBid,
  canAffordBid,
  CLEARANCE_BASE_PRICE,
  AUCTION_CLEARANCE_COUNTDOWN,
  AUCTION_BASE_COUNTDOWN,
} from '../../../../shared/constants';
import { PlayerCardView } from '../common/PlayerCardView';
import { soundManager } from '../../audio/soundEffects';
import {
  Sparkles,
  Zap,
  TrendingUp,
  AlertTriangle,
  History,
  ShieldAlert,
  Crown,
} from 'lucide-react';

interface LiveAuctionScreenProps {
  auctionState: AuctionState;
  currentManager: LobbyManager;
  onPlaceBid: () => void;
  isHost?: boolean;
  onSkipToTactics?: () => void;
}

export const LiveAuctionScreen: React.FC<LiveAuctionScreenProps> = ({
  auctionState,
  currentManager,
  onPlaceBid,
  isHost = false,
  onSkipToTactics,
}) => {
  const {
    currentCard,
    currentBid,
    highestBidderId,
    highestBidderName,
    timeRemaining,
    isClutchActive,
    bidHistory,
    currentCardIndex,
    totalCards,
    isClearanceRound,
    status,
  } = auctionState;

  const [showSquadDrawer, setShowSquadDrawer] = useState(false);
  const prevBidderRef = useRef<string | null>(highestBidderId);
  const prevTimeRef = useRef<number>(timeRemaining);

  const isLeading = highestBidderId === currentManager.managerId;
  const isClutch = timeRemaining <= 4;

  // Next bid amount calculated authoritatively ($0.5M starting price in clearance round)
  const startingPrice = currentCard
    ? isClearanceRound
      ? CLEARANCE_BASE_PRICE
      : currentCard.basePrice
    : 0;

  const nextBidAmount = currentCard
    ? calculateNextBid(currentBid, startingPrice)
    : 0;

  const canAfford = currentCard
    ? canAffordBid(currentManager.purse, nextBidAmount, currentManager.squad.length)
    : false;

  const isMaxSquad = currentManager.squad.length >= 24;
  const canBid = status === 'ACTIVE' && !isLeading && canAfford && !isMaxSquad;

  // Sound effects & haptic triggers
  useEffect(() => {
    // Tick countdown
    if (timeRemaining !== prevTimeRef.current && status === 'ACTIVE') {
      if (timeRemaining <= 4 && timeRemaining > 0) {
        soundManager.playClutchThud();
      } else if (timeRemaining > 4) {
        soundManager.playTick();
      }
      prevTimeRef.current = timeRemaining;
    }
  }, [timeRemaining, status]);

  useEffect(() => {
    if (highestBidderId !== prevBidderRef.current && highestBidderId) {
      if (highestBidderId === currentManager.managerId) {
        soundManager.playBidChime();
      } else if (prevBidderRef.current === currentManager.managerId) {
        soundManager.playOutbidWarning();
      }
      prevBidderRef.current = highestBidderId;
    }
  }, [highestBidderId, currentManager.managerId]);

  return (
    <div
      className={`flex-1 flex flex-col justify-between p-3 relative overflow-hidden transition-all duration-500 ${
        isLeading ? 'winning-bid-glow bg-amber-950/20' : ''
      }`}
    >
      {/* Top Header: Progress, Clearance Banner, Purse Tracker */}
      <div>
        <div className="flex items-center justify-between text-xs font-bold mb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-300 font-mono">
              CARD {currentCardIndex + 1} / {totalCards}
            </span>
            {isHost && onSkipToTactics && (
              <button
                onClick={onSkipToTactics}
                className="text-[9px] bg-slate-850 hover:bg-slate-750 text-cyan-300 border border-cyan-800/80 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                title="Skip to Tactics Phase"
              >
                Skip ➔ Tactics
              </button>
            )}
            {isClearanceRound && (
              <span className="text-[9px] bg-rose-500 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                Clearance Round ($0.5M Start • 10s)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[9px] text-slate-400 font-semibold uppercase">Your Purse</div>
              <div className="text-emerald-400 font-black text-sm">
                ${currentManager.purse.toFixed(1)}M
              </div>
              {isLeading && (
                <span className="text-[8px] font-bold text-amber-300 block leading-none mt-0.5">
                  (-${currentBid.toFixed(1)}M bid)
                </span>
              )}
            </div>
            <button
              onClick={() => setShowSquadDrawer(true)}
              className="text-right bg-slate-900 hover:bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
              title="Click to view acquired squad"
            >
              <div className="text-[9px] text-slate-400 uppercase">Squad</div>
              <div className="text-cyan-300 font-black text-xs flex items-center gap-1">
                <span>{currentManager.squad.length}/24</span>
                <span className="text-[8px] bg-cyan-950/80 text-cyan-400 px-1 rounded border border-cyan-800">
                  VIEW
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* 10s or 12s Countdown & Clutch Warning Bar */}
        <div className="relative w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800 mb-2">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isClutch ? 'bg-gradient-to-r from-amber-500 to-rose-500 animate-pulse' : 'bg-cyan-400'
            }`}
            style={{
              width: `${Math.max(
                0,
                (timeRemaining / (isClearanceRound ? AUCTION_CLEARANCE_COUNTDOWN : AUCTION_BASE_COUNTDOWN)) * 100
              )}%`,
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white tracking-widest uppercase pointer-events-none drop-shadow">
            {timeRemaining}s {isClutch && '• CLUTCH EXTENSION ACTIVE'} {isClearanceRound && '• CLEARANCE ($0.5M START)'}
          </div>
        </div>
      </div>

      {/* Center Stage: Spotlight Player Card View & High Bidder Banner */}
      <div className="flex flex-col items-center justify-center my-1 relative">
        {currentCard ? (
          <div className="relative">
            <PlayerCardView
              card={
                isClearanceRound
                  ? { ...currentCard, basePrice: CLEARANCE_BASE_PRICE }
                  : currentCard
              }
              size="lg"
              showPrice
              isLeadingCard={isLeading}
            />

            {/* Sold / Unsold Dramatic Overlay */}
            {status === 'CARD_SOLD' && (
              <div className="absolute inset-0 bg-black/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center z-30 cut-in-overlay border-2 border-amber-400 p-3 text-center">
                <Crown className="w-12 h-12 text-amber-400 animate-bounce mb-1" />
                <span className="font-black text-2xl text-amber-300 tracking-wider">
                  {highestBidderId === currentManager.managerId ? '🎉 CARD WON!' : 'SOLD!'}
                </span>
                <span className="font-extrabold text-sm text-white mt-1">
                  {highestBidderName}
                </span>
                <span className="font-black text-lg text-emerald-400">
                  ${currentBid.toFixed(1)}M
                </span>
                {highestBidderId === currentManager.managerId && (
                  <div className="mt-2 text-[11px] font-bold text-cyan-300 bg-cyan-950/90 border border-cyan-500/40 px-2.5 py-1 rounded-lg">
                    Purse: ${currentManager.purse.toFixed(1)}M • Squad: {currentManager.squad.length}/24
                  </div>
                )}
              </div>
            )}

            {status === 'CARD_UNSOLD' && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center z-30 cut-in-overlay border-2 border-slate-600">
                <AlertTriangle className="w-10 h-10 text-slate-400 mb-1" />
                <span className="font-black text-2xl text-slate-300 tracking-wider">UNSOLD</span>
                <span className="text-xs text-slate-400 mt-1">Queued for clearance</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-slate-400 font-bold text-sm">Preparing Next Card...</div>
        )}

        {/* Current Bid & High Bidder Banner */}
        <div className="w-full max-w-xs mt-2 glass-panel p-2 rounded-xl border border-slate-700 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              {currentBid > 0 ? 'Current Bid' : isClearanceRound ? 'Clearance Start' : 'Starting Bid'}
            </span>
            <span className="text-2xl font-black text-amber-400 font-mono">
              ${(currentBid > 0 ? currentBid : startingPrice).toFixed(1)}M
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Leading Bidder
            </span>
            <div className="flex items-center gap-1 justify-end">
              {isLeading && <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />}
              <span
                className={`font-black text-sm truncate max-w-[130px] ${
                  isLeading ? 'text-amber-300' : 'text-slate-200'
                }`}
              >
                {highestBidderName || (isClearanceRound ? 'No Bids ($0.5M Start)' : `No Bids ($${startingPrice.toFixed(1)}M Base)`)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Scrolling Bid Ticker (3 most recent bids) */}
      <div className="glass-panel rounded-xl p-2 max-h-16 overflow-y-auto border border-slate-800/80 mb-2 space-y-1">
        <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-wider">
          <History className="w-3 h-3" />
          <span>Live Bidding Feed</span>
        </div>
        {bidHistory.length === 0 ? (
          <div className="text-[11px] text-slate-500 italic text-center py-1">
            Tap button below to enter the bidding war!
          </div>
        ) : (
          bidHistory.slice(0, 3).map((bid, i) => (
            <div
              key={`${bid.timestamp}-${i}`}
              className="flex items-center justify-between text-xs py-0.5 border-b border-white/5 last:border-0"
            >
              <div className="flex items-center gap-1.5 font-bold">
                <span className={bid.managerId === currentManager.managerId ? 'text-cyan-300' : 'text-slate-300'}>
                  {bid.managerName}
                </span>
                {bid.isAi && (
                  <span className="text-[8px] bg-purple-900/80 text-purple-300 px-1 py-0.2 rounded">
                    AI
                  </span>
                )}
              </div>
              <span className="font-mono font-black text-amber-400">
                ${bid.amount.toFixed(1)}M
              </span>
            </div>
          ))
        )}
      </div>

      {/* Bottom Area: Anti-Bankruptcy Guardrail Note & Central Action Disc */}
      <div className="flex flex-col items-center">
        {!canAfford && status === 'ACTIVE' && (
          <div className="mb-2 text-[10px] font-bold text-rose-400 bg-rose-950/80 px-2.5 py-1 rounded-lg border border-rose-500/30 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" />
            <span>Anti-Bankruptcy: Need reserve for mandatory 11-man squad!</span>
          </div>
        )}

        {isLeading && (
          <div className="mb-2 text-[10px] font-extrabold text-amber-300 bg-amber-950/80 px-3 py-1 rounded-full border border-amber-500/40 flex items-center gap-1.5 animate-bounce">
            <Crown className="w-3.5 h-3.5" />
            <span>YOU HOLD THE WINNING BID!</span>
          </div>
        )}

        {/* Central Action Disc (Large thumb-accessible circular button) */}
        <button
          disabled={!canBid}
          onClick={onPlaceBid}
          className={`action-disc ${
            isClutch && canBid
              ? 'action-disc-clutch'
              : canBid
              ? 'action-disc-ready'
              : 'action-disc-disabled'
          }`}
        >
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-black/70">
            {isLeading ? 'LEADING' : 'TAP TO BID'}
          </span>
          <span className="font-black text-xl tracking-tight text-white drop-shadow-md">
            ${nextBidAmount.toFixed(1)}M
          </span>
          <span className="text-[8px] font-bold text-black/60 uppercase">
            {isClutch ? 'CLUTCH PUSH' : 'ONE-TAP'}
          </span>
        </button>
      </div>

      {/* Squad Drawer Modal */}
      {showSquadDrawer && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-40 p-4 flex flex-col justify-between cut-in-overlay">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <div>
                <h3 className="font-black text-base text-white">Your Acquired Squad</h3>
                <span className="text-xs text-slate-400">
                  {currentManager.squad.length} / 24 Players • Remaining Purse: ${currentManager.purse.toFixed(1)}M
                </span>
              </div>
              <button
                onClick={() => setShowSquadDrawer(false)}
                className="text-xs font-bold text-slate-300 hover:text-white px-2.5 py-1 bg-slate-800 rounded-lg"
              >
                Close
              </button>
            </div>

            {currentManager.squad.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                You have not acquired any players yet. Bid and win cards to fill your squad!
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-[380px] overflow-y-auto pr-1">
                {currentManager.squad.map((card, idx) => (
                  <div
                    key={`${card.id}-${idx}`}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-700 flex items-center gap-2"
                  >
                    <span className="text-base font-black text-amber-400">{card.ovr}</span>
                    <div className="truncate">
                      <span className="font-extrabold text-xs text-white truncate block">
                        {card.displayName}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {card.primaryPosition} • {card.club}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowSquadDrawer(false)}
            className="w-full py-2.5 rounded-xl font-black text-xs bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700"
          >
            Back to Live Auction
          </button>
        </div>
      )}
    </div>
  );
};
