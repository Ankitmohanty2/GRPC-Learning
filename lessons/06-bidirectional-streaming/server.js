const grpc = require('@grpc/grpc-js');
const { ReflectionService } = require('@grpc/reflection');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('06-bidi-streaming-server');
const env = getEnv();

const activeRooms = new Map();

function broadcastToRoom(room, message, senderCall) {
  const clients = activeRooms.get(room);
  if (!clients) return;

  for (const clientCall of clients) {
    if (clientCall !== senderCall && !clientCall.cancelled) {
      clientCall.write(message);
    }
  }
}

function chat(call) {
  let joinedRoom = 'general';
  let clientSender = 'anonymous';

  logger.info({ peer: call.getPeer() }, 'New client connected to Bidirectional Chat stream');

  call.on('data', (msg) => {
    clientSender = msg.sender || clientSender;
    joinedRoom = msg.room || joinedRoom;

    logger.info({ sender: msg.sender, room: msg.room, text: msg.text }, 'Received chat message');

    let roomSet = activeRooms.get(joinedRoom);
    if (!roomSet) {
      roomSet = new Set();
      activeRooms.set(joinedRoom, roomSet);
    }
    roomSet.add(call);

    const now = { seconds: Math.floor(Date.now() / 1000), nanos: 0 };
    const enrichedMsg = {
      id: msg.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sender: msg.sender,
      text: msg.text,
      room: joinedRoom,
      timestamp: now,
    };

    call.write({
      id: `ack_${enrichedMsg.id}`,
      sender: 'SystemBot',
      text: `Ack: "${msg.text}" delivered to room #${joinedRoom}`,
      room: joinedRoom,
      timestamp: now,
    });

    broadcastToRoom(joinedRoom, enrichedMsg, call);
  });

  const cleanup = () => {
    const roomSet = activeRooms.get(joinedRoom);
    if (roomSet) {
      roomSet.delete(call);
      if (roomSet.size === 0) activeRooms.delete(joinedRoom);
    }
    logger.info({ sender: clientSender, room: joinedRoom }, 'Client left chat stream');
  };

  call.on('end', () => {
    logger.info({ sender: clientSender }, 'Client signaled end of write stream');
    cleanup();
    call.end();
  });

  call.on('cancelled', () => {
    logger.warn({ sender: clientSender }, 'Client cancelled duplex stream');
    cleanup();
  });

  call.on('error', (err) => {
    logger.error({ err, sender: clientSender }, 'Duplex stream error');
    cleanup();
  });
}

function startServer(port = env.PORT + 5, host = env.HOST) {
  return new Promise((resolve, reject) => {
    const protoPath = resolveProtoPath('chat', 'v1', 'chat.proto');
    const { grpcObject, packageDefinition } = loadProtoFile(protoPath);

    const chatPkg = grpcObject.chat?.v1;
    if (!chatPkg?.ChatService?.service) {
      throw new Error('ChatService not found in chat.proto');
    }

    const server = new grpc.Server();
    server.addService(chatPkg.ChatService.service, { chat });

    const reflection = new ReflectionService(packageDefinition);
    reflection.addToServer(server);

    const address = `${host}:${port}`;
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
      if (err) {
        logger.error({ err, address }, 'Failed to bind ChatService server');
        return reject(err);
      }
      logger.info({ address: `${host}:${boundPort}` }, 'gRPC ChatService Bidi-Streaming server running');
      resolve({ server, port: boundPort });
    });
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    logger.error({ err }, 'Server fatal error');
    process.exit(1);
  });
}

module.exports = {
  startServer,
};
