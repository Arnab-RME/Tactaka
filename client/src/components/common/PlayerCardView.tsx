// ============================================================================
// Tactaka - EA FC Style Player Card Component
// ============================================================================

import React from 'react';
import { PlayerCard } from '../../../../shared/types';
import { Shield, Zap, Sparkles, Award, AlertCircle } from 'lucide-react';

interface PlayerCardViewProps {
  card: PlayerCard;
  size?: 'sm' | 'md' | 'lg';
  showPrice?: boolean;
  isLeadingCard?: boolean;
  onClick?: () => void;
  selected?: boolean;
}

export const PlayerCardView: React.FC<PlayerCardViewProps> = ({
  card,
  size = 'md',
  showPrice = false,
  isLeadingCard = false,
  onClick,
  selected = false,
}) => {
  const getFoilClass = () => {
    switch (card.tier) {
      case 1:
        return 'card-foil-t1 text-amber-100';
      case 2:
        return 'card-foil-t2 text-purple-100';
      case 3:
        return 'card-foil-t3 text-cyan-100';
      case 4:
      default:
        return 'card-foil-t4 text-slate-200';
    }
  };

  const getTierLabel = () => {
    switch (card.tier) {
      case 1:
        return 'LEGEND';
      case 2:
        return 'SUPERSTAR';
      case 3:
        return 'RISING STAR';
      case 4:
        return 'SQUAD DEPTH';
    }
  };

  const sizeClasses = {
    sm: 'w-24 p-1.5 rounded-lg text-xs',
    md: 'w-44 p-2.5 rounded-xl text-sm',
    lg: 'w-64 p-3.5 rounded-2xl text-base',
  }[size];

  return (
    <div
      onClick={onClick}
      className={`relative cursor-pointer transition-all duration-300 transform active:scale-95 ${getFoilClass()} ${sizeClasses} ${
        selected ? 'ring-4 ring-cyan-400 scale-105 shadow-cyan-500/50' : ''
      } ${isLeadingCard ? 'winning-bid-glow' : ''}`}
    >
      {/* Tier Header Tag */}
      <div className="flex items-center justify-between border-b border-white/10 pb-1 mb-1">
        <span className="text-[9px] font-black tracking-widest uppercase opacity-80 flex items-center gap-1">
          {card.tier === 1 && <Sparkles className="w-2.5 h-2.5 text-amber-400" />}
          {getTierLabel()}
        </span>
        {showPrice && (
          <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded">
            ${card.basePrice.toFixed(1)}M
          </span>
        )}
      </div>

      {/* Main OVR & Position & Club */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1">
            <span
              className={`font-black leading-none ${
                size === 'sm' ? 'text-xl' : size === 'md' ? 'text-3xl' : 'text-4xl'
              } ${card.tier === 1 ? 'text-amber-300' : 'text-white'}`}
            >
              {card.ovr}
            </span>
            <span className="font-extrabold text-xs opacity-90 text-cyan-300">
              {card.primaryPosition}
            </span>
          </div>
          <span className="text-[9px] opacity-75 font-semibold truncate max-w-[110px]">
            {card.club} • {card.nation}
          </span>
        </div>

        {/* Chemistry Dots (0 to 3) */}
        {card.chemPoints !== undefined && (
          <div className="flex gap-0.5 items-center bg-black/40 px-1 py-0.5 rounded-full">
            {[1, 2, 3].map((pt) => (
              <span
                key={pt}
                className={`w-1.5 h-1.5 rounded-full ${
                  pt <= (card.chemPoints || 0)
                    ? 'bg-emerald-400 shadow-sm shadow-emerald-400'
                    : 'bg-slate-600'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Player Display Name */}
      <div className="text-center font-black tracking-tight truncate border-y border-white/10 py-0.5 mb-1.5">
        {card.displayName}
      </div>

      {/* 6 Core Face Stats (PAC, SHO, PAS, DRI, DEF, PHY) */}
      {size !== 'sm' && (
        <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 text-[10px] font-bold bg-black/30 p-1.5 rounded-lg mb-1.5">
          <div className="flex justify-between">
            <span className="opacity-60">PAC</span>
            <span className={card.stats.pac >= 85 ? 'text-emerald-400' : 'text-slate-100'}>
              {card.stats.pac}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-60">SHO</span>
            <span className={card.stats.sho >= 85 ? 'text-emerald-400' : 'text-slate-100'}>
              {card.stats.sho}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-60">PAS</span>
            <span className={card.stats.pas >= 85 ? 'text-emerald-400' : 'text-slate-100'}>
              {card.stats.pas}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-60">DRI</span>
            <span className={card.stats.dri >= 85 ? 'text-emerald-400' : 'text-slate-100'}>
              {card.stats.dri}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-60">DEF</span>
            <span className={card.stats.def >= 85 ? 'text-emerald-400' : 'text-slate-100'}>
              {card.stats.def}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-60">PHY</span>
            <span className={card.stats.phy >= 85 ? 'text-emerald-400' : 'text-slate-100'}>
              {card.stats.phy}
            </span>
          </div>
        </div>
      )}

      {/* PlayStyles Badges */}
      {size === 'lg' && card.playstyles.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {card.playstyles.map((trait) => (
            <span
              key={trait}
              className="text-[9px] bg-white/10 backdrop-blur-sm border border-white/20 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5"
            >
              <Zap className="w-2.5 h-2.5 text-amber-300" />
              {trait}
            </span>
          ))}
        </div>
      )}

      {/* Out of position warning */}
      {card.isOutOfPosition && (
        <div className="mt-1 flex items-center gap-1 text-[9px] font-bold text-rose-400 bg-rose-950/70 px-1.5 py-0.5 rounded">
          <AlertCircle className="w-2.5 h-2.5" />
          -30% OOP PENALTY
        </div>
      )}
    </div>
  );
};
