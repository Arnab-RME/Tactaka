// ============================================================================
// Tactaka - Main Mobile Game App Controller
// ============================================================================

import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  RoomState,
  ManagerProfile,
  TournamentFormat,
  TacticsConfig,
  MatchFixture,
  LobbyManager,
} from '../../shared/types';
import { createDefaultProfile } from '../../shared/constants';
import { DeviceFrame } from './components/common/DeviceFrame';
import { LobbyScreen } from './components/lobby/LobbyScreen';
import { LiveAuctionScreen } from './components/auction/LiveAuctionScreen';
import { TacticalLockdownScreen } from './components/tactics/TacticalLockdownScreen';
import { TournamentScreen } from './components/tournament/TournamentScreen';
import { MatchBroadcastScreen } from './components/broadcast/MatchBroadcastScreen';
import { CareerScreen } from './components/career/CareerScreen';

const getInitialServerUrl = (): string => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('tactaka_server_url');
    if (saved && saved.trim()) return saved.trim();
  }
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  return typeof window !== 'undefined' && window.location.hostname
    ? `http://${window.location.hostname}:4000`
    : 'http://localhost:4000';
};

export const App: React.FC = () => {
  const [serverUrl, setServerUrl] = useState<string>(getInitialServerUrl);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [tacticsTimer, setTacticsTimer] = useState<number>(180);
  const [activeViewingMatch, setActiveViewingMatch] = useState<MatchFixture | null>(null);

  // Persistent Manager Profile
  const [managerProfile, setManagerProfile] = useState<ManagerProfile>(() => {
    try {
      const saved = localStorage.getItem('tactaka_manager_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.clubName) parsed.clubName = 'Thunderbolts FC';
        return parsed;
      }
    } catch (e) {}
    return createDefaultProfile('Manager One', 'The Gegenpresser');
  });

  // Save profile changes to localStorage
  useEffect(() => {
    localStorage.setItem('tactaka_manager_profile', JSON.stringify(managerProfile));
  }, [managerProfile]);

  const handleUpdateServerUrl = (newUrl: string) => {
    let cleaned = newUrl.trim();
    if (cleaned.endsWith('/')) {
      cleaned = cleaned.slice(0, -1);
    }
    localStorage.setItem('tactaka_server_url', cleaned);
    setServerUrl(cleaned);
  };

  // Connect to Authoritative Socket Server
  useEffect(() => {
    setConnectionStatus('connecting');
    setIsConnected(false);

    let targetUrl = serverUrl.trim();
    if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      targetUrl.startsWith('http://') &&
      !targetUrl.includes('localhost') &&
      !targetUrl.includes('127.0.0.1')
    ) {
      targetUrl = targetUrl.replace('http://', 'https://');
    }

    const s = io(targetUrl, {
      transports: ['websocket', 'polling'],
      timeout: 25000,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    s.on('connect', () => {
      console.log('Connected to Tactaka Server:', s.id);
      setIsConnected(true);
      setConnectionStatus('connected');
    });

    s.on('connect_error', (err) => {
      console.warn('Socket connection error:', err.message);
      setIsConnected(false);
      setConnectionStatus('disconnected');
    });

    s.on('disconnect', () => {
      console.log('Disconnected from Tactaka Server');
      setIsConnected(false);
      setConnectionStatus('disconnected');
    });

    s.on('room_state', (state: RoomState) => {
      setRoomState(state);
    });

    s.on('auction_update', (payload: any) => {
      setRoomState((prev: RoomState | null) => {
        if (!prev) return null;
        const auction = payload?.auctionState || payload;
        const managers = payload?.managers || prev.managers;
        return {
          ...prev,
          auction,
          managers: { ...managers },
        };
      });
    });

    s.on('card_resolved', ({ card, winnerId, finalPrice, managers }: any) => {
      setRoomState((prev: RoomState | null) => {
        if (!prev) return null;
        let updatedManagers = managers ? { ...managers } : { ...prev.managers };
        if (!managers && winnerId && updatedManagers[winnerId]) {
          const winner = { ...updatedManagers[winnerId] };
          winner.purse = Math.round((winner.purse - finalPrice) * 10) / 10;
          winner.squad = [...winner.squad, card];
          updatedManagers[winnerId] = winner;
        }
        return {
          ...prev,
          managers: updatedManagers,
        };
      });
    });

    s.on('tactics_timer', ({ remaining }: { remaining: number }) => {
      setTacticsTimer(remaining);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [serverUrl]);

  const handleUpdateProfile = (updated: Partial<ManagerProfile>) => {
    setManagerProfile((prev: ManagerProfile) => ({ ...prev, ...updated }));
  };

  // Host creates room
  const handleCreateRoom = () => {
    if (!socket) return;
    socket.emit('create_room', { profile: managerProfile }, (response: any) => {
      if (response.success) {
        setRoomState(response.roomState);
        if (response.managerId && response.managerId !== managerProfile.managerId) {
          setManagerProfile((prev: ManagerProfile) => ({ ...prev, managerId: response.managerId }));
        }
      } else {
        alert(response.error || 'Failed to create room');
      }
    });
  };

  // Join room via PIN
  const handleJoinRoom = (pin: string) => {
    if (!socket) return;
    socket.emit('join_room', { roomCode: pin, profile: managerProfile }, (response: any) => {
      if (response.success) {
        setRoomState(response.roomState);
        const resolvedId = response.manager?.managerId || response.roomState?.hostId;
        if (resolvedId && resolvedId !== managerProfile.managerId) {
          setManagerProfile((prev: ManagerProfile) => ({ ...prev, managerId: resolvedId }));
        }
      } else {
        alert(response.error || 'Failed to join room');
      }
    });
  };

  // Host sets tournament format
  const handleSetFormat = (format: TournamentFormat) => {
    if (!socket || !roomState) return;
    socket.emit('set_tournament_format', { roomCode: roomState.roomCode, format });
  };

  // Add AI Bot
  const handleAddAiBot = () => {
    if (!socket || !roomState) return;
    socket.emit('add_ai_bot', { roomCode: roomState.roomCode });
  };

  // Auto-Fill to 4 Bots
  const handleAutoFillBots = () => {
    if (!socket || !roomState) return;
    socket.emit('autofill_bots', { roomCode: roomState.roomCode });
  };

  // Start Auction
  const handleStartAuction = () => {
    if (!socket || !roomState) return;
    socket.emit('start_auction', { roomCode: roomState.roomCode }, (res: any) => {
      if (!res.success) alert(res.error);
    });
  };

  // Place Bid
  const handlePlaceBid = () => {
    if (!socket || !roomState) return;
    socket.emit('place_bid', { roomCode: roomState.roomCode }, (res: any) => {
      if (!res.success) {
        console.warn('Bid rejected:', res.error);
      }
    });
  };

  // Update Tactics
  const handleUpdateTactics = (tactics: TacticsConfig) => {
    if (!socket || !roomState) return;
    const targetManagerId = currentManagerInRoom?.managerId || managerProfile.managerId;
    setRoomState((prev) => {
      if (!prev || !prev.managers[targetManagerId]) return prev;
      return {
        ...prev,
        managers: {
          ...prev.managers,
          [targetManagerId]: {
            ...prev.managers[targetManagerId],
            tactics,
          },
        },
      };
    });
    socket.emit('update_tactics', { roomCode: roomState.roomCode, tactics });
  };

  // Finish Tactics early
  const handleFinishTactics = () => {
    if (!socket || !roomState) return;
    socket.emit('finish_tactics', {
      roomCode: roomState.roomCode,
      managerId: managerProfile.managerId,
    });
  };

  // Advance Tournament Round (Simulate Matchday)
  const handleSimulateMatchday = () => {
    if (!socket || !roomState) return;
    socket.emit('simulate_matchday', {
      roomCode: roomState.roomCode,
      managerId: managerProfile.managerId,
    });
  };

  // Direct Skip to Final Result
  const handleSkipToFinal = () => {
    if (!socket || !roomState) return;
    socket.emit('skip_to_final', {
      roomCode: roomState.roomCode,
      managerId: managerProfile.managerId,
    });
  };

  // Finish Tournament to Podium
  const handleFinishToPodium = () => {
    if (!socket || !roomState) return;
    socket.emit('finish_to_podium', {
      roomCode: roomState.roomCode,
      managerId: managerProfile.managerId,
    });
  };

  const handleAdvanceRound = () => {
    handleSimulateMatchday();
  };

  // Play Again / Reset
  const handlePlayAgain = () => {
    setRoomState(null);
    setActiveViewingMatch(null);
  };

  const currentManagerInRoom: LobbyManager | undefined =
    roomState?.managers[managerProfile.managerId] ||
    Object.values(roomState?.managers || {}).find((m) => m.socketId === socket?.id && !m.isAi);

  // RENDER CURRENT GAME PHASE
  const renderGameContent = () => {
    // If user is currently watching a 2D radar match broadcast
    if (activeViewingMatch && roomState) {
      const homeMgr = roomState.managers[activeViewingMatch.homeTeamId];
      const awayMgr = roomState.managers[activeViewingMatch.awayTeamId];

      if (homeMgr && awayMgr) {
        return (
          <MatchBroadcastScreen
            fixture={activeViewingMatch}
            homeManager={homeMgr}
            awayManager={awayMgr}
            onMatchComplete={() => setActiveViewingMatch(null)}
          />
        );
      }
    }

    // Phase: LOBBY
    if (!roomState || roomState.phase === 'LOBBY') {
      return (
        <LobbyScreen
          roomState={roomState}
          currentManager={managerProfile}
          onUpdateProfile={handleUpdateProfile}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onSetFormat={handleSetFormat}
          onAddAiBot={handleAddAiBot}
          onAutoFillBots={handleAutoFillBots}
          onStartAuction={handleStartAuction}
          isConnected={isConnected}
          connectionStatus={connectionStatus}
          serverUrl={serverUrl}
          onUpdateServerUrl={handleUpdateServerUrl}
        />
      );
    }

    // Phase: AUCTION
    if (roomState.phase === 'AUCTION' && roomState.auction && currentManagerInRoom) {
      return (
        <LiveAuctionScreen
          auctionState={roomState.auction}
          currentManager={currentManagerInRoom}
          onPlaceBid={handlePlaceBid}
          isHost={roomState.hostId === currentManagerInRoom.managerId}
          onSkipToTactics={() => socket?.emit('skip_to_tactics', { roomCode: roomState.roomCode })}
        />
      );
    }

    // Phase: TACTICS
    if (roomState.phase === 'TACTICS' && currentManagerInRoom) {
      return (
        <TacticalLockdownScreen
          currentManager={currentManagerInRoom}
          timeRemaining={tacticsTimer}
          onUpdateTactics={handleUpdateTactics}
          onFinishTactics={handleFinishTactics}
          isHost={roomState.hostId === managerProfile.managerId}
        />
      );
    }

    // Phase: TOURNAMENT
    if (roomState.phase === 'TOURNAMENT' && roomState.tournament) {
      return (
        <TournamentScreen
          tournament={roomState.tournament}
          managers={roomState.managers}
          currentManagerId={managerProfile.managerId}
          onSimulateMatchday={handleSimulateMatchday}
          onSkipToFinal={handleSkipToFinal}
          onFinishToPodium={handleFinishToPodium}
          onAdvanceRound={handleAdvanceRound}
          onWatchMatch={(fixture) => setActiveViewingMatch(fixture)}
          isHost={roomState.hostId === managerProfile.managerId}
        />
      );
    }

    // Phase: PODIUM
    if (roomState.phase === 'PODIUM') {
      return (
        <CareerScreen
          managerProfile={managerProfile}
          tournament={roomState.tournament}
          managers={roomState.managers}
          onPlayAgain={handlePlayAgain}
        />
      );
    }

    return null;
  };

  return <DeviceFrame>{renderGameContent()}</DeviceFrame>;
};

export default App;
