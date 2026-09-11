// ============================================================================
// Tactaka - Podium, Career RPG Progression & Trophy Cabinet
// ============================================================================

import React, { useEffect } from 'react';
import { ManagerProfile, TournamentState, LobbyManager } from '../../../../shared/types';
import { getXPForLevel } from '../../../../shared/constants';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Award,
  Crown,
  Sparkles,
  Shield,
  RotateCcw,
  Zap,
  TrendingUp,
} from 'lucide-react';

interface CareerScreenProps {
  managerProfile: ManagerProfile;
  tournament: TournamentState | null;
  managers: Record<string, LobbyManager>;
  onPlayAgain: () => void;
}

export const CareerScreen: React.FC<CareerScreenProps> = ({
  managerProfile,
  tournament,
  managers,
  onPlayAgain,
}) => {
  const championManager = tournament?.championId ? managers[tournament.championId] : null;
  const isUserChampion = tournament?.championId === managerProfile.managerId;

  // Trigger celebration confetti
  useEffect(() => {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#ffd700', '#00f2fe', '#00e676', '#ff1744'],
    });
  }, []);

  const nextLvlXP = getXPForLevel(managerProfile.level + 1);
  const currentLvlXP = getXPForLevel(managerProfile.level);
  const xpInLevel = managerProfile.xp - currentLvlXP;
  const xpRequiredForNext = nextLvlXP - currentLvlXP || 1;
  const progressPercent = Math.min(100, Math.max(0, (xpInLevel / xpRequiredForNext) * 100));

  return (
    <div className="flex-1 flex flex-col justify-between p-4 overflow-y-auto text-slate-100">
      {/* Podium Celebration Banner */}
      <div className="text-center pt-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-bold text-xs mb-2 animate-bounce">
          <Sparkles className="w-3.5 h-3.5" />
          <span>TOURNAMENT CONCLUDED</span>
        </div>

        <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-white to-amber-500">
          THE CHAMPION'S PODIUM
        </h2>

        {/* Trophy & Winner Showcase */}
        <div className="my-4 glass-panel p-4 rounded-3xl border-2 border-amber-400/50 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col items-center">
            <div className="relative">
              <Trophy className="w-20 h-20 text-amber-400 drop-shadow-[0_0_25px_rgba(255,215,0,0.6)]" />
              <Crown className="w-8 h-8 text-amber-300 absolute -top-3 -right-2 rotate-12" />
            </div>

            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">
              Tournament Champion
            </span>
            <span className="font-black text-2xl text-white mt-0.5">
              {championManager ? championManager.name : 'Unknown Manager'}
            </span>
            <span className="text-base text-amber-300 font-bold mt-0.5">
              {championManager?.clubCrest} {championManager?.archetype}
            </span>

            {isUserChampion && (
              <div className="mt-3 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black text-xs shadow-lg shadow-amber-400/30">
                +500 CHAMPIONSHIP CAREER XP EARNED!
              </div>
            )}
          </div>
        </div>

        {/* Individual Honors: Golden Boot & Golden Glove */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* Golden Boot */}
          <div className="glass-panel p-3 rounded-2xl border border-slate-700 text-left">
            <div className="flex items-center gap-1.5 text-amber-400 font-black text-xs uppercase mb-1">
              <Award className="w-4 h-4" />
              <span>Golden Boot</span>
            </div>
            <span className="font-extrabold text-sm text-white block truncate">
              {tournament?.goldenBootWinner
                ? tournament.goldenBootWinner.playerName
                : 'Erling Haaland'}
            </span>
            <span className="text-[10px] text-slate-400">
              {tournament?.goldenBootWinner ? `${tournament.goldenBootWinner.goals} Goals` : '4 Goals'} (
              {tournament?.goldenBootWinner?.managerName || 'Top Scorer'})
            </span>
          </div>

          {/* Golden Glove */}
          <div className="glass-panel p-3 rounded-2xl border border-slate-700 text-left">
            <div className="flex items-center gap-1.5 text-cyan-400 font-black text-xs uppercase mb-1">
              <Shield className="w-4 h-4" />
              <span>Golden Glove</span>
            </div>
            <span className="font-extrabold text-sm text-white block truncate">
              {tournament?.goldenGloveWinner
                ? tournament.goldenGloveWinner.playerName
                : 'Alisson Becker'}
            </span>
            <span className="text-[10px] text-slate-400">
              {tournament?.goldenGloveWinner
                ? `${tournament.goldenGloveWinner.cleanSheets} Clean Sheets`
                : '2 Clean Sheets'}
            </span>
          </div>
        </div>

        {/* Persistent Manager Profile & Career Level XP */}
        <div className="glass-panel p-3 rounded-2xl border border-slate-700 text-left">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="font-extrabold text-sm text-white">{managerProfile.name}</span>
              <div className="text-[10px] text-slate-400">
                {managerProfile.archetype} • Career RPG Stats
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-black text-amber-400">
                LEVEL {managerProfile.level}
              </span>
              <div className="text-[10px] text-slate-400 font-mono">
                {managerProfile.xp} Total XP
              </div>
            </div>
          </div>

          {/* XP Progress Bar */}
          <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 mb-3">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Trophy Cabinet & Record */}
          <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
            <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
              <span className="text-lg">🏆</span>
              <span className="font-black text-white block">
                {managerProfile.trophiesWon.league +
                  managerProfile.trophiesWon.worldCup +
                  managerProfile.trophiesWon.championsLeague}
              </span>
              <span className="text-[9px] text-slate-400 uppercase">Trophies</span>
            </div>

            <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
              <span className="text-lg">⚔️</span>
              <span className="font-black text-emerald-400 block">
                {managerProfile.record.wins}W
              </span>
              <span className="text-[9px] text-slate-400 uppercase">Wins</span>
            </div>

            <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
              <span className="text-lg">🛡️</span>
              <span className="font-black text-cyan-400 block">
                {managerProfile.record.cleanSheets}
              </span>
              <span className="text-[9px] text-slate-400 uppercase">Clean Sheets</span>
            </div>

            <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
              <span className="text-lg">👟</span>
              <span className="font-black text-amber-400 block">
                {managerProfile.record.goldenBoots}
              </span>
              <span className="text-[9px] text-slate-400 uppercase">Golden Boots</span>
            </div>
          </div>
        </div>
      </div>

      {/* Play Again Button */}
      <div className="pt-2 border-t border-slate-800 mt-2">
        <button
          onClick={onPlayAgain}
          className="w-full py-3.5 px-4 rounded-2xl font-black text-sm bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-black shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-2 active:scale-95"
        >
          <RotateCcw className="w-4 h-4" />
          <span>START NEW TOURNAMENT CAMPAIGN</span>
        </button>
      </div>
    </div>
  );
};
