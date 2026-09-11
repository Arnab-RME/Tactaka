import { RoomManager } from '../server/src/engine/roomManager';
import { TournamentFormat } from '../shared/types';

async function testFormat(format: TournamentFormat) {
  console.log(`\n================ Testing Format: ${format} ================`);
  const roomManager = new RoomManager();
  const room = roomManager.createRoom(
    { name: 'Host Arnab', clubName: 'Thunderbolts FC' },
    'socket-123',
    (rc, ev, payload) => {}
  );

  room.setTournamentFormat(format);
  room.autoFillBots(4);
  console.log(`Managers in room: ${Object.keys(room.state.managers).length}`);

  // Skip auction to tactics
  room.skipToTactics();
  console.log(`Room phase after skipToTactics: ${room.state.phase}`);

  // Skip tactics to tournament
  room.finishTacticalLockdown();
  console.log(`Room phase after finishTacticalLockdown: ${room.state.phase}`);
  console.log(`Tournament created:`, !!room.state.tournament);
  console.log(`Tournament format:`, room.state.tournament?.format);
  console.log(`Current round:`, room.state.tournament?.currentRound);
  console.log(`Total rounds:`, room.state.tournament?.totalRounds);
  console.log(`Fixtures count:`, room.state.tournament?.fixtures.length);

  try {
    console.log(`Calling simulateMatchday()...`);
    room.simulateMatchday();
    console.log(`simulateMatchday() completed!`);
    console.log(`Current round after sim:`, room.state.tournament?.currentRound);
    console.log(`Is complete:`, room.state.tournament?.isComplete);
    const round1Fixtures = room.state.tournament?.fixtures.filter(f => f.roundNumber === 1);
    console.log(`Round 1 finished:`, round1Fixtures?.every(f => f.isFinished));
    console.log(`Scores:`, round1Fixtures?.map(f => `${f.homeTeamName} ${f.homeScore} - ${f.awayScore} ${f.awayTeamName}`));
  } catch (err) {
    console.error(`ERROR in simulateMatchday:`, err);
  }

  try {
    console.log(`Calling skipToFinal()...`);
    room.skipToFinal();
    console.log(`skipToFinal() completed!`);
    console.log(`Is complete:`, room.state.tournament?.isComplete);
    console.log(`Champion:`, room.state.tournament?.championName);
  } catch (err) {
    console.error(`ERROR in skipToFinal:`, err);
  }
}

async function run() {
  await testFormat('LEAGUE');
  await testFormat('WORLD_CUP');
  await testFormat('CHAMPIONS_LEAGUE');
}

run();
