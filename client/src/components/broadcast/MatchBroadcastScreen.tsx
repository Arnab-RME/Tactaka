// ============================================================================
// Tactaka - 2D Radar Match Broadcast & Simulation Screen
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { MatchFixture, MatchCycleEvent, MatchStats, LobbyManager } from '../../../../shared/types';
import { soundManager } from '../../audio/soundEffects';
import confetti from 'canvas-confetti';
import {
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Award,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface MatchBroadcastScreenProps {
  fixture: MatchFixture;
  homeManager: LobbyManager;
  awayManager: LobbyManager;
  onMatchComplete: () => void;
  autoPlay?: boolean;
}

export const MatchBroadcastScreen: React.FC<MatchBroadcastScreenProps> = ({
  fixture,
  homeManager,
  awayManager,
  onMatchComplete,
  autoPlay = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [cutInEvent, setCutInEvent] = useState<MatchCycleEvent | null>(null);

  const events = fixture.events || [];
  const currentEvent = events[currentEventIndex] || null;

  const currentScore = currentEvent
    ? currentEvent.score
    : { home: fixture.homeScore || 0, away: fixture.awayScore || 0 };

  // Playback timer (runs through the ~14-24 events over ~60s)
  useEffect(() => {
    soundManager.playWhistle();
  }, []);

  useEffect(() => {
    if (!isPlaying) return;

    if (currentEventIndex >= events.length) {
      soundManager.playWhistle();
      setShowAnalytics(true);
      return;
    }

    const ev = events[currentEventIndex];

    // Check if dramatic cut-in (freeze frame for 2.2 seconds)
    if (ev && ev.isDramaticCutIn) {
      setCutInEvent(ev);
      if (ev.outcome === 'GOAL') {
        soundManager.playGoalExplosion();
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00f2fe', '#ffd700', '#00e676', '#ffffff'],
        });
      }

      const cutInTimer = setTimeout(() => {
        setCutInEvent(null);
        setCurrentEventIndex((prev) => prev + 1);
      }, 2400);

      return () => clearTimeout(cutInTimer);
    }

    // Normal cycle step (~2.2 seconds per possession phase)
    const timer = setTimeout(() => {
      setCurrentEventIndex((prev) => prev + 1);
    }, 2200);

    return () => clearTimeout(timer);
  }, [currentEventIndex, isPlaying, events]);

  // Render 2D Radar Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear Pitch background
    ctx.fillStyle = '#0a1410';
    ctx.fillRect(0, 0, width, height);

    // Pitch markings (minimalist dark tactical radar)
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.25)';
    ctx.lineWidth = 1.5;

    // Border
    ctx.strokeRect(10, 10, width - 20, height - 20);

    // Halfway line & Center Circle
    ctx.beginPath();
    ctx.moveTo(width / 2, 10);
    ctx.lineTo(width / 2, height - 10);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 35, 0, Math.PI * 2);
    ctx.stroke();

    // Penalty boxes
    ctx.strokeRect(10, height / 2 - 45, 50, 90);
    ctx.strokeRect(width - 60, height / 2 - 45, 50, 90);

    // Draw Home Team Glowing Discs (Cyan)
    const homeX = width * 0.35;
    const homePositions = [
      { x: 25, y: height / 2 }, // GK
      { x: 60, y: height * 0.25 },
      { x: 55, y: height * 0.45 },
      { x: 55, y: height * 0.55 },
      { x: 60, y: height * 0.75 },
      { x: homeX, y: height * 0.3 },
      { x: homeX - 10, y: height / 2 },
      { x: homeX, y: height * 0.7 },
      { x: width * 0.48, y: height * 0.25 },
      { x: width * 0.52, y: height / 2 },
      { x: width * 0.48, y: height * 0.75 },
    ];

    homePositions.forEach((pos) => {
      ctx.beginPath();
      ctx.fillStyle = '#00f2fe';
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 8;
      ctx.arc(pos.x, pos.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Away Team Glowing Discs (Amber/Gold)
    const awayPositions = [
      { x: width - 25, y: height / 2 }, // GK
      { x: width - 60, y: height * 0.25 },
      { x: width - 55, y: height * 0.45 },
      { x: width - 55, y: height * 0.55 },
      { x: width - 60, y: height * 0.75 },
      { x: width - homeX, y: height * 0.3 },
      { x: width - homeX + 10, y: height / 2 },
      { x: width - homeX, y: height * 0.7 },
      { x: width - width * 0.48, y: height * 0.25 },
      { x: width - width * 0.52, y: height / 2 },
      { x: width - width * 0.48, y: height * 0.75 },
    ];

    awayPositions.forEach((pos) => {
      ctx.beginPath();
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 8;
      ctx.arc(pos.x, pos.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Reset shadow
    ctx.shadowBlur = 0;

    // Draw Ball & Progression Trail from Current Event
    if (currentEvent) {
      const ballX = (currentEvent.coordinates.ballX / 100) * width;
      const ballY = (currentEvent.coordinates.ballY / 100) * height;

      // Passing / Transition Trail
      ctx.beginPath();
      ctx.strokeStyle =
        currentEvent.attackingTeamId === homeManager.managerId
          ? 'rgba(0, 242, 254, 0.4)'
          : 'rgba(255, 215, 0, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.moveTo(width / 2, height / 2);
      ctx.lineTo(ballX, ballY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Ball Glowing Disc
      ctx.beginPath();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 12;
      ctx.arc(ballX, ballY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }, [currentEvent, homeManager.managerId]);

  return (
    <div className="flex-1 flex flex-col justify-between p-3 relative overflow-hidden">
      {/* Top Header: Scoreboard & Minute Clock */}
      <div className="glass-panel p-3 rounded-2xl border border-slate-700 mb-2">
        <div className="flex items-center justify-between">
          {/* Home Team */}
          <div className="flex items-center gap-2 flex-1">
            <span className="text-2xl">{homeManager.clubCrest}</span>
            <div className="truncate">
              <span className="font-black text-sm text-cyan-300 truncate block">
                {homeManager.name}
              </span>
              <span className="text-[10px] text-slate-400">
                {homeManager.tactics.playingStyle}
              </span>
            </div>
          </div>

          {/* Score Box */}
          <div className="flex flex-col items-center px-4">
            <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase font-mono">
              {currentEvent ? `${currentEvent.minute}'` : '90\' FT'}
            </span>
            <div className="flex items-center gap-2 font-mono font-black text-3xl text-white">
              <span>{currentScore.home}</span>
              <span className="text-slate-500">-</span>
              <span>{currentScore.away}</span>
            </div>
          </div>

          {/* Away Team */}
          <div className="flex items-center gap-2 flex-1 justify-end text-right">
            <div className="truncate">
              <span className="font-black text-sm text-amber-300 truncate block">
                {awayManager.name}
              </span>
              <span className="text-[10px] text-slate-400">
                {awayManager.tactics.playingStyle}
              </span>
            </div>
            <span className="text-2xl">{awayManager.clubCrest}</span>
          </div>
        </div>
      </div>

      {/* Center 2D Radar Canvas */}
      <div className="flex-1 flex flex-col items-center justify-center relative my-1">
        <div className="relative w-full aspect-[16/10] max-w-sm rounded-2xl overflow-hidden border-2 border-emerald-500/30 shadow-2xl">
          <canvas
            ref={canvasRef}
            width={380}
            height={240}
            className="w-full h-full object-contain"
          />

          {/* Phase Badge */}
          {currentEvent && (
            <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-300 border border-white/10 uppercase">
              Phase: {currentEvent.phase}
            </div>
          )}

          {/* Dramatic Cut-In Overlay on Goals/Saves */}
          {cutInEvent && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 z-30 cut-in-overlay border-2 border-amber-400">
              <Sparkles className="w-12 h-12 text-amber-400 animate-spin mb-1" />
              <div className="text-center">
                <span className="text-xs font-black tracking-widest text-amber-400 uppercase block">
                  {cutInEvent.outcome} ALERT!
                </span>
                <span className="text-2xl font-black text-white mt-0.5 block">
                  {cutInEvent.goalScorer || cutInEvent.attackerPlayerName}
                </span>
                <p className="text-xs text-slate-300 mt-1 max-w-xs italic">
                  "{cutInEvent.commentary}"
                </p>
                <div className="mt-2 font-mono font-black text-2xl text-emerald-400">
                  {cutInEvent.score.home} - {cutInEvent.score.away}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Event Commentary Ticker */}
      <div className="glass-panel p-3 rounded-2xl border border-slate-700 min-h-[72px] flex items-center mb-2">
        {currentEvent ? (
          <div className="w-full">
            <div className="flex items-center gap-1.5 text-[10px] font-black text-cyan-400 uppercase tracking-wider mb-0.5">
              <span>LIVE MATCHDAY COMMENTARY</span>
              <span>•</span>
              <span className="text-slate-400">{currentEvent.minute}' MINUTE</span>
            </div>
            <p className="text-xs font-semibold text-slate-100 leading-snug">
              {currentEvent.commentary}
            </p>
          </div>
        ) : (
          <div className="text-center w-full text-xs text-slate-400 italic">
            Full-time reached. Tap below to inspect post-match analytics!
          </div>
        )}
      </div>

      {/* Action / Controls Bar */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowAnalytics(true)}
          className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
        >
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          <span>Match Analytics (xG)</span>
        </button>

        <button
          onClick={onMatchComplete}
          className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-black text-xs flex items-center justify-center gap-1 shadow-md shadow-cyan-500/20 transition-all active:scale-95"
        >
          <span>Continue</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Post-Match Analytics Modal */}
      {showAnalytics && fixture.stats && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-lg z-50 p-4 flex flex-col justify-between cut-in-overlay">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
                <h3 className="font-black text-base text-white">Post-Match Analytics</h3>
              </div>
              <button
                onClick={() => setShowAnalytics(false)}
                className="text-xs font-bold text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded-lg"
              >
                Close
              </button>
            </div>

            {/* Score header */}
            <div className="text-center font-mono font-black text-3xl text-white mb-4">
              {homeManager.name} {fixture.stats.homeScore} - {fixture.stats.awayScore} {awayManager.name}
            </div>

            {/* Comparison Metrics */}
            <div className="space-y-3 max-w-sm mx-auto text-xs font-bold">
              {/* xG */}
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>{fixture.stats.homeXG.toFixed(2)}</span>
                  <span className="text-white font-extrabold">Expected Goals (xG)</span>
                  <span>{fixture.stats.awayXG.toFixed(2)}</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full flex overflow-hidden">
                  <div
                    className="bg-cyan-400 h-full"
                    style={{
                      width: `${
                        (fixture.stats.homeXG / (fixture.stats.homeXG + fixture.stats.awayXG || 1)) *
                        100
                      }%`,
                    }}
                  />
                  <div className="bg-amber-400 h-full flex-1" />
                </div>
              </div>

              {/* Possession % */}
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>{fixture.stats.homePossession}%</span>
                  <span className="text-white font-extrabold">Possession</span>
                  <span>{fixture.stats.awayPossession}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full flex overflow-hidden">
                  <div
                    className="bg-cyan-400 h-full"
                    style={{ width: `${fixture.stats.homePossession}%` }}
                  />
                  <div className="bg-amber-400 h-full flex-1" />
                </div>
              </div>

              {/* Total Shots */}
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-cyan-300">{fixture.stats.homeShots}</span>
                <span className="text-slate-300">Total Shots</span>
                <span className="text-amber-300">{fixture.stats.awayShots}</span>
              </div>

              {/* Shots on Target */}
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-cyan-300">{fixture.stats.homeShotsOnTarget}</span>
                <span className="text-slate-300">Shots on Target</span>
                <span className="text-amber-300">{fixture.stats.awayShotsOnTarget}</span>
              </div>

              {/* Corners */}
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-cyan-300">{fixture.stats.homeCorners}</span>
                <span className="text-slate-300">Corners Won</span>
                <span className="text-amber-300">{fixture.stats.awayCorners}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setShowAnalytics(false);
              onMatchComplete();
            }}
            className="w-full py-3 px-4 rounded-xl font-black text-sm bg-cyan-400 hover:bg-cyan-300 text-black text-center shadow-lg shadow-cyan-500/30"
          >
            Advance Tournament
          </button>
        </div>
      )}
    </div>
  );
};
