// ============================================================================
// Tactaka - Tournament Standings, Matchdays & Simulation Screen
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  TournamentState,
  LobbyManager,
  MatchFixture,
  TournamentFormat,
} from '../../../../shared/types';
import {
  Trophy,
  Calendar,
  ChevronRight,
  Play,
  FastForward,
  Shield,
  Info,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface TournamentScreenProps {
  tournament: TournamentState;
  managers: Record<string, LobbyManager>;
  currentManagerId: string;
  onSimulateMatchday: () => void;
  onSkipToFinal: () => void;
  onFinishToPodium: () => void;
  onAdvanceRound?: () => void;
  onWatchMatch: (fixture: MatchFixture) => void;
  isHost: boolean;
}

export const TournamentScreen: React.FC<TournamentScreenProps> = ({
  tournament,
  managers,
  currentManagerId,
  onSimulateMatchday,
  onSkipToFinal,
  onFinishToPodium,
  onWatchMatch,
  isHost,
}) => {
  // Current active view tab: 'standings' | matchday number (1, 2, 3...)
  const [activeTab, setActiveTab] = useState<'standings' | number>(() => {
    return tournament.isComplete ? 'standings' : tournament.currentRound;
  });

  // Track if format info banner is expanded
  const [showFormatDetails, setShowFormatDetails] = useState<boolean>(true);

  // Sync active tab to current round when round advances
  useEffect(() => {
    if (tournament.isComplete) {
      setActiveTab('standings');
    } else {
      setActiveTab(tournament.currentRound);
    }
  }, [tournament.currentRound, tournament.isComplete]);

  // Determine current round status
  const currentRoundFixtures = tournament.fixtures.filter(
    (f) => f.roundNumber === tournament.currentRound
  );
  const isCurrentRoundFinished =
    currentRoundFixtures.length > 0 && currentRoundFixtures.every((f) => f.isFinished);

  // Format details helper
  const getFormatDetails = (format: TournamentFormat) => {
    switch (format) {
      case 'WORLD_CUP':
        return {
          title: 'World Cup Tournament',
          tagline: 'Group Stage to Knockout Showdown',
          description:
            'Clubs compete in groups followed by high-stakes single-elimination semi-finals and the grand final. Extra time and penalties are active.',
          trophyIcon: '🏆',
          badgeText: 'KNOCKOUT CUP',
          rules: ['Group Round-Robin', 'Single-Leg Semi-Finals', 'Grand Final Showdown', 'Extra Time & Penalties'],
        };
      case 'CHAMPIONS_LEAGUE':
        return {
          title: 'UEFA Champions League',
          tagline: 'European Elite Club Tournament',
          description:
            'Match 1 League qualifier followed by home-and-away two-legged semi-finals with aggregate scoring and a neutral grand final.',
          trophyIcon: '⭐',
          badgeText: 'UCL FORMAT',
          rules: ['Match 1 League Phase', '2-Legged Semi-Finals', 'Aggregate Scoring', 'Neutral Grand Final'],
        };
      case 'LEAGUE':
      default:
        return {
          title: 'Domestic League Championship',
          tagline: 'Single Round-Robin Title Race',
          description:
            'Every club battles every opponent once. 3 points for a win, 1 point for a draw. The club sitting top of the table after all matchdays lifts the crown.',
          trophyIcon: '🏆',
          badgeText: 'DOMESTIC LEAGUE',
          rules: ['Single Round-Robin', '3 Pts Win / 1 Pt Draw', 'GD & Goals Tiebreaker', '14 Duel Cycles / Match'],
        };
    }
  };

  const formatInfo = getFormatDetails(tournament.format);

  // Determine which fixtures to display based on active tab
  const displayedFixtures =
    typeof activeTab === 'number'
      ? tournament.fixtures.filter((f) => f.roundNumber === activeTab)
      : currentRoundFixtures;

  // Extract goalscorers from fixture events
  const getGoalscorersList = (fixture: MatchFixture) => {
    if (!fixture.events || fixture.events.length === 0) return [];
    const goals = fixture.events.filter((ev) => ev.outcome === 'GOAL' && ev.goalScorer);
    return goals.map((g) => ({
      player: g.goalScorer || 'Player',
      minute: g.minute,
      isHome: g.attackingTeamId === fixture.homeTeamId,
    }));
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-3 overflow-y-auto bg-slate-950 text-white">
      {/* Top Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400/20 to-yellow-500/10 border border-amber-400/40 flex items-center justify-center text-lg shadow-md shadow-amber-500/10">
              {formatInfo.trophyIcon}
            </div>
            <div>
              <h2 className="font-black text-sm tracking-wide text-white flex items-center gap-1.5">
                <span>{formatInfo.title}</span>
              </h2>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <span>
                  Matchday {tournament.currentRound} of {tournament.totalRounds}
                </span>
                <span>•</span>
                <span className="text-cyan-400">{Object.keys(managers).length} Managers</span>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div
            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1.5 ${
              tournament.isComplete
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-300 shadow-md shadow-amber-500/20'
                : isCurrentRoundFinished
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                : 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300 animate-pulse'
            }`}
          >
            {tournament.isComplete ? (
              <>
                <Trophy className="w-3 h-3" />
                <span>CHAMPION DECIDED</span>
              </>
            ) : isCurrentRoundFinished ? (
              <>
                <CheckCircle2 className="w-3 h-3" />
                <span>MATCHDAY {tournament.currentRound} FINISHED</span>
              </>
            ) : (
              <>
                <Clock className="w-3 h-3" />
                <span>MATCHDAY {tournament.currentRound} SCHEDULED</span>
              </>
            )}
          </div>
        </div>

        {/* Competition Style & Format Card */}
        <div className="glass-panel rounded-2xl p-3 border border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950/80 shadow-lg relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-500/30 text-[9px] font-black text-cyan-300 uppercase tracking-wider">
                  {formatInfo.badgeText}
                </span>
                <span className="text-[11px] font-bold text-slate-300">
                  {formatInfo.tagline}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {formatInfo.description}
              </p>
            </div>
            <button
              onClick={() => setShowFormatDetails(!showFormatDetails)}
              className="p-1.5 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white transition-colors"
              title="Toggle Rules"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Expanded Rules Tags */}
          {showFormatDetails && (
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5">
              {formatInfo.rules.map((rule, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-[10px] text-slate-300 font-medium flex items-center gap-1"
                >
                  <span className="w-1 h-1 rounded-full bg-cyan-400" />
                  {rule}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Navigation Tabs (Standings vs Matchdays) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveTab('standings')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'standings'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30 font-black'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-3 h-3" />
            <span>Standings</span>
          </button>

          {Array.from({ length: tournament.totalRounds }, (_, i) => i + 1).map((roundNum) => {
            const isFinished = tournament.fixtures
              .filter((f) => f.roundNumber === roundNum)
              .every((f) => f.isFinished);
            const isCurrent = tournament.currentRound === roundNum;

            return (
              <button
                key={roundNum}
                onClick={() => setActiveTab(roundNum)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === roundNum
                    ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30'
                    : isFinished
                    ? 'bg-slate-900 border border-emerald-500/30 text-emerald-400'
                    : isCurrent
                    ? 'bg-slate-900 border border-cyan-500/40 text-cyan-300 animate-pulse'
                    : 'bg-slate-900 border border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                {isFinished ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Clock className="w-3 h-3" />
                )}
                <span>Matchday {roundNum}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: STANDINGS VIEW */}
        {activeTab === 'standings' && (
          <div className="space-y-3">
            {tournament.leagueTable && tournament.leagueTable.length > 0 && (
              <div className="glass-panel rounded-2xl p-3 border border-slate-800 bg-slate-900/60 shadow-lg">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                  <span>League Standings</span>
                  <span className="font-mono">P · W · D · L · GD · PTS</span>
                </div>

                <div className="space-y-1.5 text-xs">
                  {tournament.leagueTable.map((row, idx) => {
                    const isUser = row.managerId === currentManagerId;
                    const mgr = managers[row.managerId];

                    return (
                      <div
                        key={row.managerId}
                        className={`flex items-center justify-between p-2.5 rounded-xl transition-all border ${
                          isUser
                            ? 'bg-cyan-950/50 border-cyan-500/50 text-white shadow-md shadow-cyan-500/10'
                            : idx === 0 && tournament.isComplete
                            ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                            : 'bg-slate-900/70 border-slate-800/80 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className={`font-black w-5 text-center text-xs ${
                              idx === 0
                                ? 'text-amber-400 font-extrabold'
                                : idx === 1
                                ? 'text-slate-300 font-bold'
                                : idx === 2
                                ? 'text-amber-600 font-bold'
                                : 'text-slate-500'
                            }`}
                          >
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                          </span>
                          <span className="text-base">{mgr?.clubCrest || '⚽'}</span>
                          <div className="truncate">
                            <span className="truncate font-extrabold block text-xs">
                              {mgr?.clubName || row.managerName}
                            </span>
                            <span className="text-[9px] text-slate-400 block -mt-0.5 truncate">
                              {mgr?.name} • {mgr?.archetype || 'Tactician'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 font-mono text-xs">
                          <span className="text-slate-400 text-[11px]">
                            {row.played}
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            {row.won}
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            {row.drawn}
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            {row.lost}
                          </span>
                          <span
                            className={`w-7 text-right font-semibold ${
                              row.goalDifference > 0
                                ? 'text-emerald-400'
                                : row.goalDifference < 0
                                ? 'text-rose-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                          </span>
                          <span className="font-black text-sm text-cyan-300 w-6 text-right">
                            {row.points}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* If tournament complete, show champion & awards banner */}
            {tournament.isComplete && (
              <div className="glass-panel rounded-2xl p-4 border border-amber-500/40 bg-gradient-to-b from-amber-950/40 via-slate-900/80 to-slate-950 shadow-xl shadow-amber-500/10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-2xl shadow-lg shadow-amber-500/30 animate-bounce">
                    🏆
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                      Tournament Champion
                    </span>
                    <h3 className="font-black text-base text-white">
                      {tournament.championId && managers[tournament.championId]
                        ? managers[tournament.championId].name
                        : 'Champion Manager'}
                    </h3>
                    <span className="text-xs text-amber-200/70 font-semibold">
                      Trophy Lifted · Title Won
                    </span>
                  </div>
                </div>

                {/* Awards Grid */}
                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-amber-500/20 text-xs">
                  {tournament.goldenBootWinner && (
                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-amber-500/20">
                      <div className="flex items-center gap-1.5 text-amber-400 font-black text-[10px] uppercase tracking-wider mb-1">
                        <span>👟</span>
                        <span>Golden Boot</span>
                      </div>
                      <div className="font-bold text-white truncate text-xs">
                        {tournament.goldenBootWinner.playerName}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {tournament.goldenBootWinner.goals} Goals ({tournament.goldenBootWinner.managerName})
                      </div>
                    </div>
                  )}

                  {tournament.goldenGloveWinner && (
                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-cyan-500/20">
                      <div className="flex items-center gap-1.5 text-cyan-400 font-black text-[10px] uppercase tracking-wider mb-1">
                        <span>🧤</span>
                        <span>Golden Glove</span>
                      </div>
                      <div className="font-bold text-white truncate text-xs">
                        {tournament.goldenGloveWinner.playerName}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {tournament.goldenGloveWinner.cleanSheets} Clean Sheets ({tournament.goldenGloveWinner.managerName})
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MATCHDAY FIXTURES / RESULTS VIEW */}
        {typeof activeTab === 'number' && (
          <div className="glass-panel rounded-2xl p-3 border border-slate-800 bg-slate-900/50 shadow-lg">
            <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2.5">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  Matchday {activeTab}{' '}
                  {displayedFixtures.every((f) => f.isFinished) ? '— Results' : '— Scheduled Matches'}
                </span>
              </span>
              <span className="text-slate-500 font-bold">
                {displayedFixtures.length} Matches
              </span>
            </div>

            <div className="space-y-2.5">
              {displayedFixtures.map((fixture) => {
                const isUserMatch =
                  fixture.homeTeamId === currentManagerId || fixture.awayTeamId === currentManagerId;
                const homeMgr = managers[fixture.homeTeamId];
                const awayMgr = managers[fixture.awayTeamId];
                const goalscorers = getGoalscorersList(fixture);

                return (
                  <div
                    key={fixture.id}
                    className={`p-3 rounded-2xl border transition-all ${
                      isUserMatch
                        ? 'border-cyan-500/50 bg-gradient-to-r from-cyan-950/40 via-slate-900/80 to-slate-900/80 shadow-md shadow-cyan-500/10'
                        : 'border-slate-800/80 bg-slate-900/70'
                    }`}
                  >
                    {/* Fixture Header / Clubs */}
                    <div className="flex items-center justify-between gap-2">
                      {/* Home Team */}
                      <div className="flex-1 flex items-center justify-end gap-2 truncate">
                        <div className="text-right truncate">
                          <span className="font-black text-xs text-white truncate block">
                            {homeMgr?.clubName || fixture.homeTeamName}
                          </span>
                          <span className="text-[9px] text-slate-400 block -mt-0.5 truncate">
                            {homeMgr?.name} • {homeMgr?.tactics?.formation || '4-3-3'}
                          </span>
                        </div>
                        <span className="text-lg">{homeMgr?.clubCrest || '⚽'}</span>
                      </div>

                      {/* Score or VS Badge */}
                      <div className="px-3 py-1 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col items-center justify-center min-w-[70px]">
                        {fixture.isFinished ? (
                          <div className="text-center">
                            <span className="font-mono font-black text-sm text-emerald-400 tracking-wider">
                              {fixture.homeScore ?? 0} - {fixture.awayScore ?? 0}
                            </span>
                            {fixture.isPenalties && (
                              <span className="text-[8px] font-bold text-amber-400 block font-mono">
                                ({fixture.homePenaltyScore}-{fixture.awayPenaltyScore} pen)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] font-black text-cyan-300 tracking-widest">
                            VS
                          </span>
                        )}
                      </div>

                      {/* Away Team */}
                      <div className="flex-1 flex items-center justify-start gap-2 truncate">
                        <span className="text-lg">{awayMgr?.clubCrest || '⚽'}</span>
                        <div className="text-left truncate">
                          <span className="font-black text-xs text-white truncate block">
                            {awayMgr?.clubName || fixture.awayTeamName}
                          </span>
                          <span className="text-[9px] text-slate-400 block -mt-0.5 truncate">
                            {awayMgr?.name} • {awayMgr?.tactics?.formation || '4-3-3'}
                          </span>
                        </div>
                      </div>

                      {/* Watch Broadcast Replay Button (if finished) */}
                      {fixture.isFinished && (
                        <button
                          onClick={() => onWatchMatch(fixture)}
                          className="p-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:text-white transition-all active:scale-90 flex-shrink-0"
                          title="Watch 2D Match Broadcast"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                      )}
                    </div>

                    {/* Goalscorers Breakdown (if finished and goals scored) */}
                    {fixture.isFinished && goalscorers.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-800/60 text-[10px] text-slate-300 space-y-0.5">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          {goalscorers.map((g, idx) => (
                            <span
                              key={idx}
                              className={`px-1.5 py-0.5 rounded-md font-medium text-[9px] flex items-center gap-1 ${
                                g.isHome
                                  ? 'bg-slate-800 text-cyan-300'
                                  : 'bg-slate-800 text-emerald-300'
                              }`}
                            >
                              <span>⚽</span>
                              <span>
                                {g.player} {g.minute}'
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Match Stats Summary */}
                    {fixture.isFinished && fixture.stats && (
                      <div className="mt-2 pt-1.5 border-t border-slate-800/40 flex items-center justify-between text-[9px] text-slate-400 font-mono px-1">
                        <span>
                          {fixture.stats.homeShots} Shots ({fixture.stats.homeShotsOnTarget} on target)
                        </span>
                        <span className="text-slate-500 font-bold">
                          {fixture.stats.homePossession}% Poss {fixture.stats.awayPossession}%
                        </span>
                        <span>
                          {fixture.stats.awayShots} Shots ({fixture.stats.awayShotsOnTarget} on target)
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Host Action Bar & Controls */}
      <div className="pt-3 border-t border-slate-800/80 mt-3 space-y-2">
        {isHost ? (
          <>
            {/* STATE 1: Current round has not been simulated yet */}
            {!isCurrentRoundFinished && !tournament.isComplete && (
              <>
                <button
                  onClick={() => {
                    setActiveTab(tournament.currentRound);
                    onSimulateMatchday();
                  }}
                  className="w-full py-3.5 px-4 rounded-xl font-black text-sm bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-black shadow-xl shadow-cyan-500/25 flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>
                    {tournament.currentRound >= tournament.totalRounds
                      ? 'SIMULATE FINAL MATCHDAY'
                      : `SIMULATE MATCHDAY ${tournament.currentRound}`}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('standings');
                    onSkipToFinal();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl font-black text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md cursor-pointer"
                >
                  <FastForward className="w-3.5 h-3.5 text-amber-400" />
                  <span>SKIP TO THE FINAL RESULT</span>
                </button>
              </>
            )}

            {/* STATE 2: Current round finished, and there are more rounds remaining */}
            {isCurrentRoundFinished && !tournament.isComplete && (
              <>
                <button
                  onClick={() => {
                    setActiveTab(tournament.currentRound + 1);
                    onSimulateMatchday();
                  }}
                  className="w-full py-3.5 px-4 rounded-xl font-black text-sm bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-black shadow-xl shadow-cyan-500/25 flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer"
                >
                  <span>
                    {tournament.currentRound + 1 >= tournament.totalRounds
                      ? 'SIMULATE FINAL MATCHDAY'
                      : `SIMULATE MATCHDAY ${tournament.currentRound + 1}`}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    setActiveTab('standings');
                    onSkipToFinal();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl font-black text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md cursor-pointer"
                >
                  <FastForward className="w-3.5 h-3.5 text-amber-400" />
                  <span>SKIP TO THE FINAL RESULT</span>
                </button>
              </>
            )}

            {/* STATE 3: Tournament Complete -> Proceed to Podium */}
            {tournament.isComplete && (
              <button
                onClick={onFinishToPodium}
                className="w-full py-3.5 px-4 rounded-xl font-black text-sm bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-black shadow-xl shadow-amber-500/30 flex items-center justify-center gap-2 active:scale-95 transition-transform animate-pulse cursor-pointer"
              >
                <Trophy className="w-4 h-4 fill-current" />
                <span>VIEW PODIUM & CAREER XP</span>
              </button>
            )}
          </>
        ) : (
          /* Non-host spectator status */
          <div className="py-3 px-4 text-center text-xs text-slate-400 font-semibold bg-slate-900/90 rounded-xl border border-slate-800 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>
              {tournament.isComplete
                ? 'Waiting for Host to view Podium & Career Rewards...'
                : isCurrentRoundFinished
                ? `Waiting for Host to proceed to Matchday ${tournament.currentRound + 1}...`
                : `Waiting for Host to start Matchday ${tournament.currentRound}...`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentScreen;
