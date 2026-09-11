import { io } from 'socket.io-client';
import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { RoomManager } from '../server/src/engine/roomManager';

async function testFullSocketFlow() {
  // Start an in-memory test server
  const app = express();
  const server = http.createServer(app);
  const ioServer = new SocketIOServer(server, { cors: { origin: '*' } });
  const roomManager = new RoomManager();

  ioServer.on('connection', (socket) => {
    console.log('[Server] Socket connected:', socket.id);

    socket.on('create_room', (data, cb) => {
      const room = roomManager.createRoom(data.profile || {}, socket.id, (code, ev, payload) => {
        ioServer.to(code).emit(ev, payload);
      });
      socket.join(room.state.roomCode);
      if (cb) cb({ success: true, roomCode: room.state.roomCode, roomState: room.state, managerId: room.state.hostId });
    });

    socket.on('autofill_bots', ({ roomCode }, cb) => {
      const room = roomManager.getRoom(roomCode);
      if (room) {
        room.autoFillBots(4);
        if (cb) cb({ success: true });
      }
    });

    socket.on('skip_to_tactics', ({ roomCode }) => {
      const room = roomManager.getRoom(roomCode);
      const session = roomManager.getManagerSession(socket.id);
      console.log('[Server] skip_to_tactics received. Session:', session, 'HostId:', room?.state.hostId);
      if (room && session?.managerId === room.state.hostId) {
        room.skipToTactics();
      }
    });

    socket.on('finish_tactics', ({ roomCode }) => {
      const room = roomManager.getRoom(roomCode);
      const session = roomManager.getManagerSession(socket.id);
      console.log('[Server] finish_tactics received. Session:', session, 'HostId:', room?.state.hostId);
      if (room && session?.managerId === room.state.hostId) {
        room.finishTacticalLockdown();
      }
    });

    socket.on('simulate_matchday', ({ roomCode }) => {
      const room = roomManager.getRoom(roomCode);
      const session = roomManager.getManagerSession(socket.id);
      console.log('[Server] simulate_matchday received. Session:', session, 'HostId:', room?.state.hostId);
      if (room && session?.managerId === room.state.hostId) {
        console.log('[Server] Host verified! Calling room.simulateMatchday()...');
        try {
          room.simulateMatchday();
          console.log('[Server] simulateMatchday completed successfully!');
        } catch (e) {
          console.error('[Server] ERROR in room.simulateMatchday():', e);
        }
      } else {
        console.warn('[Server] simulate_matchday REJECTED! Session mismatch or room not found.');
      }
    });

    socket.on('skip_to_final', ({ roomCode }) => {
      const room = roomManager.getRoom(roomCode);
      const session = roomManager.getManagerSession(socket.id);
      console.log('[Server] skip_to_final received. Session:', session, 'HostId:', room?.state.hostId);
      if (room && session?.managerId === room.state.hostId) {
        console.log('[Server] Host verified! Calling room.skipToFinal()...');
        try {
          room.skipToFinal();
          console.log('[Server] skipToFinal completed successfully!');
        } catch (e) {
          console.error('[Server] ERROR in room.skipToFinal():', e);
        }
      } else {
        console.warn('[Server] skip_to_final REJECTED! Session mismatch or room not found.');
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(4899, () => resolve()));
  console.log('[Server] Listening on 4899');

  // Connect client
  const clientSocket = io('http://localhost:4899', { transports: ['websocket'] });
  await new Promise<void>((resolve) => clientSocket.on('connect', () => resolve()));
  console.log('[Client] Connected with ID:', clientSocket.id);

  let currentRoomState: any = null;
  clientSocket.on('room_state', (st) => {
    currentRoomState = st;
    console.log('[Client] Received room_state update. Phase:', st.phase, 'Round:', st.tournament?.currentRound);
  });

  // 1. Create room
  const createRes: any = await new Promise((resolve) => {
    clientSocket.emit('create_room', {
      profile: {
        managerId: 'mgr-test-host',
        name: 'Arnab',
        clubName: 'Thunderbolts FC',
      }
    }, resolve);
  });

  console.log('[Client] Room created:', createRes.roomCode);
  const roomCode = createRes.roomCode;

  // 2. Autofill bots
  await new Promise((resolve) => clientSocket.emit('autofill_bots', { roomCode }, resolve));
  console.log('[Client] Bots filled');

  // 3. Skip to tactics
  clientSocket.emit('skip_to_tactics', { roomCode });
  await new Promise((r) => setTimeout(r, 500));

  // 4. Finish tactics -> start tournament
  clientSocket.emit('finish_tactics', { roomCode });
  await new Promise((r) => setTimeout(r, 500));

  console.log('[Client] Current Phase:', currentRoomState?.phase);
  console.log('[Client] Tournament Format:', currentRoomState?.tournament?.format);
  console.log('[Client] Current Round:', currentRoomState?.tournament?.currentRound);

  // 5. Emit simulate_matchday ("GO TO MATCHDAY 1")
  console.log('\n--- TESTING SIMULATE_MATCHDAY ---');
  clientSocket.emit('simulate_matchday', { roomCode });
  await new Promise((r) => setTimeout(r, 1000));

  // 6. Emit skip_to_final ("SKIP TO THE FINAL RESULT")
  console.log('\n--- TESTING SKIP_TO_FINAL ---');
  clientSocket.emit('skip_to_final', { roomCode });
  await new Promise((r) => setTimeout(r, 1000));

  clientSocket.disconnect();
  server.close();
  console.log('\n--- TEST COMPLETE ---');
}

testFullSocketFlow();
