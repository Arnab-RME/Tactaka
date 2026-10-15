// ============================================================================
// Tactaka - Technical Director's Suite & Match Lobby
// ============================================================================

import React, { useState } from 'react';
import {
  ManagerProfile,
  RoomState,
  TacticalArchetype,
  TournamentFormat,
} from '../../../../shared/types';
import { ARCHETYPE_INFO, getXPForLevel } from '../../../../shared/constants';
import {
  Trophy,
  Users,
  Shield,
  Zap,
  Play,
  Plus,
  Compass,
  Flame,
  CheckCircle2,
  Copy,
  Check,
  Dices,
  Sun,
  Moon,
  Sparkles,
  Building2,
  UserCheck,
  Server,
  Settings2,
  Loader2,
  WifiOff,
  AlertCircle,
} from 'lucide-react';

interface LobbyScreenProps {
  roomState: RoomState | null;
  currentManager: ManagerProfile;
  onUpdateProfile: (profile: Partial<ManagerProfile>) => void;
  onCreateRoom: () => void;
  onJoinRoom: (pin: string) => void;
  onSetFormat: (format: TournamentFormat) => void;
  onAddAiBot: () => void;
  onAutoFillBots: () => void;
  onStartAuction: () => void;
  isConnected: boolean;
  connectionStatus?: 'connected' | 'connecting' | 'disconnected';
  serverUrl?: string;
  onUpdateServerUrl?: (url: string) => void;
}

// 12 Curated Football Manager Avatar Presets
export const MANAGER_AVATAR_PRESETS = [
  { id: 'suit', name: 'The Tactician', url: 'https://api.dicebear.com/7.x/personas/svg?seed=Marcus&clothing=suit' },
  { id: 'tracksuit', name: 'Tracksuit Boss', url: 'https://api.dicebear.com/7.x/personas/svg?seed=Jurgen&clothing=hoodie' },
  { id: 'maestro', name: 'Sideline Maestro', url: 'https://api.dicebear.com/7.x/personas/svg?seed=Carlo&hair=short' },
  { id: 'professor', name: 'The Professor', url: 'https://api.dicebear.com/7.x/personas/svg?seed=Arsene&eyes=glasses' },
  { id: 'galactico', name: 'Galactico Legend', url: 'https://api.dicebear.com/7.x/personas/svg?seed=Zizou&clothing=collar' },
  { id: 'motivator', name: 'Fiery Commander', url: 'https://api.dicebear.com/7.x/personas/svg?seed=Diego&mood=determined' },
  { id: 'visionary', name: 'Modern Visionary', url: 'https://api.dicebear.com/7.x/personas/svg?seed=Mikel&hair=curly' },
  { id: 'silverfox', name: 'Silver Fox', url: 'https://api.dicebear.com/7.x/personas/svg?seed=Fergie&hair=grey' },
  { id: 'director', name: 'Technical Director', url: 'https://api.dicebear.com/7.x/personas/svg?seed=Paolo&clothing=blazer' },
  { id: 'general', name: 'High-Press General', url: 'https://api.dicebear.com/7.x/personas/svg?seed=Julian&hair=buzzcut' },
  { id: 'special', name: 'The Special One', url: 'https://api.dicebear.com/7.x/personas/svg?seed=Jose&clothing=coat' },
  { id: 'dynamo', name: 'Total Footballer', url: 'https://api.dicebear.com/7.x/personas/svg?seed=Johan&hair=wavy' },
];

export const CLUB_CREST_OPTIONS = [
  '⚡', '🦁', '🦅', '🏆', '👑', '🛡️', '🔥', '⚔️', '🐺', '⚓', '🔴', '🔵', '⚪', '🟢', '⚽', '🌟'
];

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  roomState,
  currentManager,
  onUpdateProfile,
  onCreateRoom,
  onJoinRoom,
  onSetFormat,
  onAddAiBot,
  onAutoFillBots,
  onStartAuction,
  isConnected,
  connectionStatus = isConnected ? 'connected' : 'disconnected',
  serverUrl = 'http://localhost:4000',
  onUpdateServerUrl,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [copiedPin, setCopiedPin] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [nameInput, setNameInput] = useState(currentManager.name);
  const [clubNameInput, setClubNameInput] = useState(currentManager.clubName || 'Thunderbolts FC');
  const [crestInput, setCrestInput] = useState(currentManager.clubCrest);
  const [avatarInput, setAvatarInput] = useState(currentManager.avatarUrl);

  // Server configuration modal state
  const [isConfiguringServer, setIsConfiguringServer] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(serverUrl);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const handleTestAndSaveServer = async () => {
    let cleaned = serverUrlInput.trim();
    if (!cleaned) return;
    if (cleaned.endsWith('/')) cleaned = cleaned.slice(0, -1);
    if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      cleaned.startsWith('http://') &&
      !cleaned.includes('localhost') &&
      !cleaned.includes('127.0.0.1')
    ) {
      cleaned = cleaned.replace('http://', 'https://');
      setServerUrlInput(cleaned);
    }

    setTestStatus('testing');
    setTestMessage('Pinging server health check...');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(`${cleaned}/api/health`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setTestStatus('success');
        setTestMessage(`Server is Online! (${data.service || 'Tactaka Game Server'})`);
        if (onUpdateServerUrl) {
          onUpdateServerUrl(cleaned);
        }
        setTimeout(() => setIsConfiguringServer(false), 1200);
      } else {
        setTestStatus('failed');
        setTestMessage(`Server returned HTTP ${res.status}. Saving URL anyway...`);
        if (onUpdateServerUrl) {
          onUpdateServerUrl(cleaned);
        }
      }
    } catch (err: any) {
      setTestStatus('failed');
      if (err.name === 'AbortError') {
        setTestMessage('Request timed out. If using Render free tier, it may be waking up (~45s). URL saved.');
      } else {
        setTestMessage('Could not reach server directly (CORS/SSL). URL saved for Socket.IO connection.');
      }
      if (onUpdateServerUrl) {
        onUpdateServerUrl(cleaned);
      }
    }
  };

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('tactaka_theme') as 'dark' | 'light') || 'dark';
  });

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('tactaka_theme', next);
    if (next === 'light') {
      document.documentElement.classList.add('theme-light');
      document.documentElement.classList.remove('theme-dark');
    } else {
      document.documentElement.classList.add('theme-dark');
      document.documentElement.classList.remove('theme-light');
    }
  };

  const archetypes: TacticalArchetype[] = [
    'The Gegenpresser',
    'The Architect',
    'The Catenaccio',
    'The Motivator',
  ];

  const getArchetypeIcon = (arch: TacticalArchetype) => {
    switch (arch) {
      case 'The Gegenpresser':
        return <Zap className="w-4 h-4 text-amber-400" />;
      case 'The Architect':
        return <Compass className="w-4 h-4 text-cyan-400" />;
      case 'The Catenaccio':
        return <Shield className="w-4 h-4 text-emerald-400" />;
      case 'The Motivator':
        return <Flame className="w-4 h-4 text-rose-400" />;
    }
  };

  const handleCopyPin = () => {
    if (!roomState) return;
    navigator.clipboard.writeText(roomState.roomCode);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  // Generate random avatar seed
  const handleShuffleAvatar = () => {
    const randomSeed = `Coach_${Math.random().toString(36).substring(2, 8)}`;
    const newUrl = `https://api.dicebear.com/7.x/personas/svg?seed=${randomSeed}`;
    setAvatarInput(newUrl);
    onUpdateProfile({ avatarUrl: newUrl });
  };

  // Select preset avatar
  const handleSelectPresetAvatar = (url: string) => {
    setAvatarInput(url);
    onUpdateProfile({ avatarUrl: url });
  };

  // Save profile changes
  const handleSaveProfile = () => {
    onUpdateProfile({
      name: nameInput.trim() || 'Manager',
      clubName: clubNameInput.trim() || 'Thunderbolts FC',
      clubCrest: crestInput,
      avatarUrl: avatarInput,
    });
    setIsEditingProfile(false);
  };

  const renderServerModal = () => {
    if (!isConfiguringServer) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl p-5 shadow-2xl relative space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-cyan-400" />
              <h3 className="font-black text-sm text-white">Game Server Connection</h3>
            </div>
            <button
              onClick={() => setIsConfiguringServer(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="text-xs text-slate-300 space-y-1.5">
            <p className="leading-relaxed">
              Tactaka requires a live Node.js/Socket.IO backend to run card auctions, manage contracts, and simulate tournament matches.
            </p>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Enter your live <strong>Render.com</strong> URL below (e.g. <span className="text-cyan-300 font-mono">https://tactaka.onrender.com</span>).
            </p>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-wider block mb-1">
              Backend Server URL
            </label>
            <input
              type="text"
              value={serverUrlInput}
              onChange={(e) => setServerUrlInput(e.target.value)}
              placeholder="https://your-service.onrender.com"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
            />
          </div>

          {testMessage && (
            <div
              className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                testStatus === 'success'
                  ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                  : testStatus === 'failed'
                  ? 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
                  : 'bg-cyan-950/60 border border-cyan-500/40 text-cyan-300'
              }`}
            >
              {testStatus === 'testing' && <Loader2 className="w-4 h-4 animate-spin text-cyan-400 flex-shrink-0" />}
              {testStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
              {testStatus === 'failed' && <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
              <span className="text-[11px] leading-tight">{testMessage}</span>
            </div>
          )}

          {/* Quick Presets */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setServerUrlInput('http://localhost:4000')}
              className="flex-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold border border-slate-700 transition-colors cursor-pointer"
            >
              Localhost (4000)
            </button>
            {import.meta.env.VITE_SERVER_URL && (
              <button
                type="button"
                onClick={() => setServerUrlInput(import.meta.env.VITE_SERVER_URL)}
                className="flex-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-bold border border-cyan-500/30 transition-colors cursor-pointer"
              >
                Env Default
              </button>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsConfiguringServer(false)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleTestAndSaveServer}
              disabled={testStatus === 'testing' || !serverUrlInput.trim()}
              className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {testStatus === 'testing' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <span>Save & Connect</span>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // IF NOT IN ROOM YET: Main Landing / Join Screen
  if (!roomState) {
    return (
      <div className="flex-1 flex flex-col p-4 justify-between overflow-y-auto">
        {renderServerModal()}
        {/* Top Header & Branding */}
        <div>
          <div className="flex items-center justify-between pt-1 pb-2">
            {/* Server Connection Status Pill */}
            <button
              onClick={() => setIsConfiguringServer(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[10px] font-mono font-bold tracking-wide transition-all cursor-pointer ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60 shadow-sm shadow-emerald-500/20'
                  : connectionStatus === 'connecting'
                  ? 'bg-amber-950/70 text-amber-300 border-amber-500/40 animate-pulse hover:bg-amber-900/60'
                  : 'bg-rose-950/70 text-rose-300 border-rose-500/40 hover:bg-rose-900/60 shadow-sm shadow-rose-500/20'
              }`}
              title="Click to configure Game Server (Render / Localhost)"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-400'
                    : connectionStatus === 'connecting'
                    ? 'bg-amber-400 animate-ping'
                    : 'bg-rose-400'
                }`}
              />
              <span>
                {connectionStatus === 'connected'
                  ? 'SERVER ONLINE'
                  : connectionStatus === 'connecting'
                  ? 'WAKING UP...'
                  : 'SERVER OFFLINE'}
              </span>
              <Settings2 className="w-3 h-3 opacity-70 ml-0.5" />
            </button>

            {/* Quick Day / Night Toggle */}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Toggle Day / Night Mode"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3 h-3 text-amber-400" />
                  <span>Day Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-3 h-3 text-indigo-400" />
                  <span>Night Mode</span>
                </>
              )}
            </button>
          </div>

          {/* Render Wake-Up / Disconnect Notice */}
          {connectionStatus === 'connecting' && (
            <div className="mt-1 mb-2 p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/40 flex items-start gap-2.5 text-xs text-amber-200">
              <Loader2 className="w-4 h-4 text-amber-400 animate-spin flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-[11px] leading-snug">
                <span className="font-bold">Waking up Render Game Server...</span>
                <p className="text-amber-300/80 mt-0.5">
                  Free Render servers spin down during inactivity and take <strong>~30–50s</strong> to boot up. The tournament buttons will activate the moment it responds!
                </p>
              </div>
            </div>
          )}

          {connectionStatus === 'disconnected' && (
            <div className="mt-1 mb-2 p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 flex items-center justify-between gap-2 text-xs text-rose-200">
              <div className="flex items-center gap-2 text-[11px]">
                <WifiOff className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <div>
                  <span className="font-bold">Backend Server Offline</span>
                  <p className="text-rose-300/80 text-[10px]">
                    Connect your Render URL to enable online tournaments.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsConfiguringServer(true)}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] cursor-pointer shadow-sm transition-all"
              >
                Configure URL
              </button>
            </div>
          )}

          <div className="text-center py-2">
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
              <span>TACTAKA</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-mono">
                PRO
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Authoritative Tactical Football Management Simulator
            </p>
          </div>

          {/* Manager & Club Office Card */}
          <div className="glass-panel rounded-2xl p-4 my-2 border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {/* Manager Avatar with Crest Overlay */}
                <div className="relative w-12 h-12 rounded-2xl overflow-hidden border-2 border-cyan-400/50 bg-slate-900 shadow-md flex-shrink-0">
                  <img
                    src={avatarInput || currentManager.avatarUrl}
                    alt="Manager Avatar"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/personas/svg?seed=${currentManager.name}`;
                    }}
                  />
                  <div className="absolute -bottom-1 -right-1 text-sm bg-slate-950/90 rounded-full px-1 py-0.5 border border-slate-700">
                    {crestInput || currentManager.clubCrest}
                  </div>
                </div>

                {/* Club & Manager Title */}
                <div className="truncate">
                  <h2 className="font-black text-sm text-white truncate">
                    {currentManager.clubName || 'Thunderbolts FC'}
                  </h2>
                  <div className="text-xs text-slate-300 font-semibold flex items-center gap-1.5 truncate">
                    <span>{currentManager.name}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-amber-400 font-black text-[11px]">
                      LVL {currentManager.level}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {currentManager.xp} / {getXPForLevel(currentManager.level + 1)} XP
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  if (isEditingProfile) {
                    handleSaveProfile();
                  } else {
                    setIsEditingProfile(true);
                  }
                }}
                className={`text-xs font-black px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  isEditingProfile
                    ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                    : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30'
                }`}
              >
                {isEditingProfile ? 'Save' : 'Customize'}
              </button>
            </div>

            {/* Profile Customization Drawer */}
            {isEditingProfile && (
              <div className="mb-3 pt-3 border-t border-slate-800 space-y-3">
                {/* 1. Avatar Customizer / Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-cyan-400" />
                      <span>Manager Avatar Selection</span>
                    </label>
                    <button
                      onClick={handleShuffleAvatar}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Dices className="w-3 h-3" />
                      <span>Shuffle Look</span>
                    </button>
                  </div>

                  {/* 12 Avatar Presets Grid */}
                  <div className="grid grid-cols-6 gap-1.5 mb-2">
                    {MANAGER_AVATAR_PRESETS.map((preset) => {
                      const isSelected = avatarInput === preset.url;
                      return (
                        <button
                          key={preset.id}
                          onClick={() => handleSelectPresetAvatar(preset.url)}
                          className={`w-10 h-10 rounded-xl p-0.5 border transition-all cursor-pointer relative overflow-hidden bg-slate-900 ${
                            isSelected
                              ? 'border-cyan-400 ring-2 ring-cyan-400/50 scale-105 shadow-md shadow-cyan-500/30'
                              : 'border-slate-800 hover:border-slate-600 opacity-75 hover:opacity-100'
                          }`}
                          title={preset.name}
                        >
                          <img
                            src={preset.url}
                            alt={preset.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Club Name & Manager Name Inputs */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-wider block mb-1">
                      Club / Team Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Real Madrid CF"
                      value={clubNameInput}
                      onChange={(e) => setClubNameInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-wider block mb-1">
                      Manager Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Arnab Sarker"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                {/* 3. Club Crest Emoji Palette */}
                <div>
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-wider block mb-1">
                    Official Club Badge Icon
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {CLUB_CREST_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          setCrestInput(emoji);
                        }}
                        className={`text-base p-1.5 rounded-xl border transition-all cursor-pointer ${
                          crestInput === emoji
                            ? 'border-cyan-400 bg-cyan-950/60 shadow-md shadow-cyan-500/20 scale-105'
                            : 'border-slate-800 bg-slate-900/80 hover:bg-slate-800'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tactical Archetype Selector */}
            <div className="mt-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Manager Archetype & Philosophy
                </span>
                <span className="text-[10px] font-black text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-500/30">
                  {ARCHETYPE_INFO[currentManager.archetype].badge}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {archetypes.map((arch) => {
                  const isSelected = currentManager.archetype === arch;
                  return (
                    <button
                      key={arch}
                      onClick={() => onUpdateProfile({ archetype: arch })}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-950/50 shadow-sm shadow-cyan-500/30'
                          : 'border-slate-800 bg-slate-900/60 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        {getArchetypeIcon(arch)}
                        <span className={isSelected ? 'text-cyan-200' : 'text-slate-300'}>
                          {arch}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 mt-2 leading-relaxed bg-black/40 p-2 rounded-xl border border-white/5 font-mono">
                {ARCHETYPE_INFO[currentManager.archetype].description}
              </p>
            </div>
          </div>
        </div>

        {/* Join / Create Match Actions */}
        <div className="space-y-3 pb-2 pt-2">
          {/* Join via PIN */}
          <div className="glass-panel p-3.5 rounded-2xl border border-slate-800 shadow-lg">
            <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wide">
              Join Match Room with PIN
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="ENTER 6-DIGIT PIN"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.toUpperCase())}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-center font-mono font-black tracking-widest text-lg text-white uppercase focus:outline-none focus:border-cyan-400"
              />
              <button
                disabled={pinInput.length < 4 || !isConnected}
                onClick={() => onJoinRoom(pinInput)}
                className="px-5 py-2.5 rounded-xl font-black text-sm bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black shadow-lg shadow-cyan-500/20 disabled:opacity-40 transition-all cursor-pointer"
              >
                JOIN
              </button>
            </div>
          </div>

          {/* Create Room Button */}
          <button
            onClick={() => {
              if (!isConnected) {
                setIsConfiguringServer(true);
              } else {
                onCreateRoom();
              }
            }}
            disabled={!isConnected && connectionStatus === 'connecting'}
            className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm tracking-wide flex items-center justify-center gap-2 shadow-xl transition-all active:scale-[0.98] cursor-pointer ${
              isConnected
                ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-400 text-black shadow-amber-500/25'
                : connectionStatus === 'connecting'
                ? 'bg-amber-600/50 text-amber-100 border border-amber-400/30 opacity-80 cursor-wait'
                : 'bg-gradient-to-r from-rose-500 via-rose-600 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white shadow-rose-500/25'
            }`}
          >
            {connectionStatus === 'connecting' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>WAKING UP SERVER (~30-50s)...</span>
              </>
            ) : isConnected ? (
              <>
                <Plus className="w-5 h-5" />
                <span>CREATE NEW TOURNAMENT ROOM</span>
              </>
            ) : (
              <>
                <Server className="w-5 h-5" />
                <span>CONNECT RENDER SERVER TO PLAY</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ROOM CREATED / JOINED: Active Lobby Screen
  const isHost = roomState.hostId === currentManager.managerId;
  const managersList = Object.values(roomState.managers);
  const managerCount = managersList.length;

  return (
    <div className="flex-1 flex flex-col p-4 justify-between overflow-y-auto">
      {renderServerModal()}
      {/* Room Header & PIN Display */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">ROOM PIN:</span>
            <span className="font-mono font-black text-2xl text-cyan-300 tracking-widest bg-slate-900 border border-cyan-500/40 px-3 py-0.5 rounded-xl shadow-inner">
              {roomState.roomCode}
            </span>
            <button
              onClick={handleCopyPin}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Copy PIN"
            >
              {copiedPin ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-400 bg-amber-950/60 px-2.5 py-1 rounded-full border border-amber-500/30">
            <Users className="w-3.5 h-3.5" />
            <span>{managerCount} / 12</span>
          </div>
        </div>

        {/* Tournament Format Selector (Host Only) */}
        <div className="glass-panel p-3 rounded-2xl border border-slate-800 mb-3 shadow-md">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase text-slate-300 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Tournament Format</span>
            </span>
            {!isHost && (
              <span className="text-[10px] text-slate-400">Host Decision</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(['LEAGUE', 'WORLD_CUP', 'CHAMPIONS_LEAGUE'] as TournamentFormat[]).map((fmt) => {
              const isSelected = roomState.tournamentFormat === fmt;
              const label =
                fmt === 'LEAGUE' ? 'League' : fmt === 'WORLD_CUP' ? 'World Cup' : 'UCL';
              return (
                <button
                  key={fmt}
                  disabled={!isHost}
                  onClick={() => onSetFormat(fmt)}
                  className={`py-2 px-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-400 text-black shadow-md shadow-cyan-500/30'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Roster of Joined Clubs & Managers */}
        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Official Team Sheets ({managerCount})</span>
            <span>Purse Reserve</span>
          </div>
          {managersList.map((mgr) => (
            <div
              key={mgr.managerId}
              className="glass-panel p-2.5 rounded-2xl border border-slate-800 flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5 truncate">
                {/* Manager Avatar */}
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 flex-shrink-0 relative">
                  <img
                    src={mgr.avatarUrl}
                    alt={mgr.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/personas/svg?seed=${mgr.name}`;
                    }}
                  />
                  <span className="absolute -bottom-1 -right-1 text-xs bg-black/80 px-0.5 rounded">
                    {mgr.clubCrest}
                  </span>
                </div>

                <div className="truncate">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-black text-xs text-white truncate">
                      {mgr.clubName || mgr.name}
                    </span>
                    {mgr.isHost && (
                      <span className="text-[8px] bg-amber-400/20 text-amber-300 font-extrabold px-1.5 py-0.5 rounded">
                        HOST
                      </span>
                    )}
                    {mgr.isAi && (
                      <span className="text-[8px] bg-purple-400/20 text-purple-300 font-extrabold px-1.5 py-0.5 rounded">
                        AI
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5 truncate">
                    <span>Mgr: {mgr.name}</span>
                    <span>•</span>
                    <span className="text-cyan-300">{mgr.archetype}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 font-mono">
                <span className="text-emerald-400 font-black text-xs">${mgr.purse.toFixed(1)}M</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lobby Controls & Auction Start */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        {isHost && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onAddAiBot}
              disabled={managerCount >= 12}
              className="py-2.5 px-3 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add AI Club
            </button>
            <button
              onClick={onAutoFillBots}
              disabled={managerCount >= 4}
              className="py-2.5 px-3 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              Auto-Fill to 4
            </button>
          </div>
        )}

        {isHost ? (
          <button
            onClick={onStartAuction}
            disabled={managerCount < 1}
            className="w-full py-3.5 px-4 rounded-2xl font-black text-sm tracking-wide flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 hover:from-emerald-300 hover:to-teal-400 text-black shadow-xl shadow-emerald-500/25 transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>START LIVE CARD AUCTION ({managerCount} CLUBS)</span>
          </button>
        ) : (
          <div className="py-3 px-4 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs font-semibold text-slate-300 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Waiting for Host to initiate the Live Auction...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LobbyScreen;
