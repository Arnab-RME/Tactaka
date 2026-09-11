// ============================================================================
// Tactaka - Authoritative Real-Time Server
// ============================================================================

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { RoomManager } from './engine/roomManager';
import { TournamentFormat, TacticsConfig } from '../../shared/types';
import { MASTER_PLAYER_DATABASE } from './playerDatabase';

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const roomManager = new RoomManager();

// Broadcast helper
function broadcastToRoom(roomCode: string, event: string, payload: any) {
  io.to(roomCode).emit(event, payload);
}

// REST Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now(), service: 'Tactaka Game Server' });
});

app.get('/api/players', (req, res) => {
  res.json({ total: MASTER_PLAYER_DATABASE.length, players: MASTER_PLAYER_DATABASE });
});

// WebSocket Connection Lifecycle
io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // Create Room
  socket.on('create_room', (data, callback) => {
    try {
      const room = roomManager.createRoom(
        data.profile || {},
        socket.id,
        (roomCode, event, payload) => {
          broadcastToRoom(roomCode, event, payload);
        }
      );

      socket.join(room.state.roomCode);
      console.log(`[Room] Created ${room.state.roomCode} by ${socket.id}`);

      if (callback) {
        callback({
          success: true,
          roomCode: room.state.roomCode,
          roomState: room.state,
          managerId: room.state.hostId,
        });
      }
    } catch (err: any) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // Join Room via PIN
  socket.on('join_room', (data, callback) => {
    try {
      const { roomCode, profile } = data;
      const { room, manager, error } = roomManager.joinRoom(roomCode, profile, socket.id);

      if (error || !room || !manager) {
        if (callback) callback({ success: false, error: error || 'Failed to join room' });
        return;
      }

      socket.join(room.state.roomCode);
      console.log(`[Room] Manager ${manager.name} (${manager.managerId}) joined ${room.state.roomCode}`);

      // Broadcast update to room
      room.broadcastState();

      if (callback) {
        callback({
          success: true,
          roomCode: room.state.roomCode,
          roomState: room.state,
          manager,
        });
      }
    } catch (err: any) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // Set Tournament Format
  socket.on('set_tournament_format', ({ roomCode, format }: { roomCode: string; format: TournamentFormat }) => {
    const room = roomManager.getRoom(roomCode);
    if (room && room.state.hostId === roomManager.getManagerSession(socket.id)?.managerId) {
      room.setTournamentFormat(format);
    }
  });

  // Add AI Bot to lobby
  socket.on('add_ai_bot', ({ roomCode }: { roomCode: string }, callback) => {
    const room = roomManager.getRoom(roomCode);
    if (room) {
      const bot = room.addAiBot();
      if (callback) callback({ success: !!bot, bot });
    }
  });

  // Auto-fill bots to 4
  socket.on('autofill_bots', ({ roomCode }: { roomCode: string }, callback) => {
    const room = roomManager.getRoom(roomCode);
    if (room) {
      room.autoFillBots(4);
      if (callback) callback({ success: true });
    }
  });

  // Start Auction
  socket.on('start_auction', ({ roomCode }: { roomCode: string }, callback) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) {
      if (callback) callback({ success: false, error: 'Room not found' });
      return;
    }

    const session = roomManager.getManagerSession(socket.id);
    if (session?.managerId !== room.state.hostId) {
      if (callback) callback({ success: false, error: 'Only host can start auction' });
      return;
    }

    const res = room.startAuction();
    if (callback) callback(res);
  });

  // Place Bid (Single-Tap Action Disc)
  socket.on('place_bid', ({ roomCode }: { roomCode: string }, callback) => {
    const room = roomManager.getRoom(roomCode);
    if (!room || !room.auctionEngine) {
      if (callback) callback({ success: false, error: 'Auction not active' });
      return;
    }

    const session = roomManager.getManagerSession(socket.id);
    if (!session) {
      if (callback) callback({ success: false, error: 'Unauthorized bidder' });
      return;
    }

    const result = room.auctionEngine.placeBid(session.managerId, false);
    if (callback) callback(result);
  });

  // Update Tactics
  socket.on('update_tactics', ({ roomCode, tactics }: { roomCode: string; tactics: TacticsConfig }) => {
    const room = roomManager.getRoom(roomCode);
    const session = roomManager.getManagerSession(socket.id);
    if (room && session) {
      room.updateManagerTactics(session.managerId, tactics);
    }
  });

  // Helper to verify host identity and rebind socket if reconnected
  const verifyHost = (roomCode?: string, clientManagerId?: string): { room?: any; isHost: boolean } => {
    if (!roomCode) return { isHost: false };
    const room = roomManager.getRoom(roomCode);
    if (!room) return { isHost: false };

    const session = roomManager.getManagerSession(socket.id);
    const callerId = clientManagerId || session?.managerId;
    const isHost = !!(callerId && callerId === room.state.hostId);

    if (isHost && callerId) {
      roomManager.rebindSocket(socket.id, room.state.roomCode, callerId);
      socket.join(room.state.roomCode);
    }
    return { room, isHost };
  };

  // Reconnect Session Event
  socket.on('reconnect_session', (data: { roomCode: string; managerId: string }, callback) => {
    const room = roomManager.getRoom(data?.roomCode);
    if (room && data?.managerId && room.state.managers[data.managerId]) {
      room.state.managers[data.managerId].socketId = socket.id;
      roomManager.rebindSocket(socket.id, data.roomCode, data.managerId);
      socket.join(room.state.roomCode);
      console.log(`[Socket] Reconnected manager ${data.managerId} to room ${data.roomCode}`);
      if (callback) callback({ success: true, roomState: room.state });
    } else {
      if (callback) callback({ success: false, error: 'Room or manager not found' });
    }
  });

  // Finish Tactical Lockdown early (Host override)
  socket.on('finish_tactics', (data: { roomCode: string; managerId?: string }, callback) => {
    const { room, isHost } = verifyHost(data?.roomCode, data?.managerId);
    if (room && isHost) {
      room.finishTacticalLockdown();
      if (callback) callback({ success: true });
    } else {
      if (callback) callback({ success: false, error: 'Not authorized or room not found' });
    }
  });

  // Skip to Tactics (Host override)
  socket.on('skip_to_tactics', (data: { roomCode: string; managerId?: string }, callback) => {
    const { room, isHost } = verifyHost(data?.roomCode, data?.managerId);
    if (room && isHost) {
      room.skipToTactics();
      if (callback) callback({ success: true });
    } else {
      if (callback) callback({ success: false, error: 'Not authorized or room not found' });
    }
  });

  // Simulate Current Matchday (Host: "Go to Matchday 1", "Go to Matchday 2", etc.)
  socket.on('simulate_matchday', (data: { roomCode: string; managerId?: string }, callback) => {
    const { room, isHost } = verifyHost(data?.roomCode, data?.managerId);
    if (room && isHost) {
      try {
        room.simulateMatchday();
        console.log(`[Room ${room.state.roomCode}] Simulated matchday. Round: ${room.state.tournament?.currentRound}`);
        if (callback) callback({ success: true, roomState: room.state });
      } catch (err: any) {
        console.error(`[Room ${room.state.roomCode}] simulateMatchday error:`, err);
        if (callback) callback({ success: false, error: err.message });
      }
    } else {
      console.warn(`[Socket] simulate_matchday rejected for room: ${data?.roomCode}`);
      if (callback) callback({ success: false, error: 'Not authorized or room not found' });
    }
  });

  // Direct Skip to Final Result (Host: "Skip to Final Result")
  socket.on('skip_to_final', (data: { roomCode: string; managerId?: string }, callback) => {
    const { room, isHost } = verifyHost(data?.roomCode, data?.managerId);
    if (room && isHost) {
      try {
        room.skipToFinal();
        console.log(`[Room ${room.state.roomCode}] Skipped to final. Complete: ${room.state.tournament?.isComplete}`);
        if (callback) callback({ success: true, roomState: room.state });
      } catch (err: any) {
        console.error(`[Room ${room.state.roomCode}] skipToFinal error:`, err);
        if (callback) callback({ success: false, error: err.message });
      }
    } else {
      console.warn(`[Socket] skip_to_final rejected for room: ${data?.roomCode}`);
      if (callback) callback({ success: false, error: 'Not authorized or room not found' });
    }
  });

  // Finish Tournament and Enter Podium (Host Action)
  socket.on('finish_to_podium', (data: { roomCode: string; managerId?: string }, callback) => {
    const { room, isHost } = verifyHost(data?.roomCode, data?.managerId);
    if (room && isHost) {
      try {
        room.finishToPodium();
        console.log(`[Room ${room.state.roomCode}] Advanced to podium`);
        if (callback) callback({ success: true, roomState: room.state });
      } catch (err: any) {
        console.error(`[Room ${room.state.roomCode}] finishToPodium error:`, err);
        if (callback) callback({ success: false, error: err.message });
      }
    } else {
      if (callback) callback({ success: false, error: 'Not authorized or room not found' });
    }
  });

  // Advance Tournament Round (Backwards Compatibility)
  socket.on('advance_round', (data: { roomCode: string; managerId?: string }, callback) => {
    const { room, isHost } = verifyHost(data?.roomCode, data?.managerId);
    if (room && isHost) {
      try {
        room.advanceRound();
        if (callback) callback({ success: true, roomState: room.state });
      } catch (err: any) {
        console.error(`[Room ${room.state.roomCode}] advanceRound error:`, err);
        if (callback) callback({ success: false, error: err.message });
      }
    } else {
      if (callback) callback({ success: false, error: 'Not authorized or room not found' });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
    roomManager.handleDisconnect(socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`⚽ Tactaka Authoritative Server Running on port ${PORT}`);
  console.log(`⚽ Mode: Real-Time Duel Engine & Live Card Auction`);
  console.log(`=============================================`);
});
