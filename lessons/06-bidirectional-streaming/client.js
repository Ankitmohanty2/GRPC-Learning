const grpc = require('@grpc/grpc-js');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('06-bidi-streaming-client');
const env = getEnv();

function createChatClient(target = `${env.HOST}:${env.PORT + 5}`) {
  const protoPath = resolveProtoPath('chat', 'v1', 'chat.proto');
  const { grpcObject } = loadProtoFile(protoPath);
  const chatPkg = grpcObject.chat?.v1;
  return new chatPkg.ChatService(target, grpc.credentials.createInsecure());
}

function runClient(
  target = `${env.HOST}:${env.PORT + 5}`,
  sender = 'Alice',
  room = 'general',
  messagesToSend = ['Hi everyone!', 'Is anyone exploring gRPC today?'],
) {
  return new Promise((resolve, reject) => {
    const client = createChatClient(target);
    const receivedMessages = [];

    logger.info({ sender, room, target }, 'Connecting to Bidirectional Chat stream');

    const stream = client.chat();

    stream.on('data', (msg) => {
      logger.info({ from: msg.sender, text: msg.text }, 'Received chat message from stream');
      console.log(`[Room: #${msg.room}] ${msg.sender}: ${msg.text}`);
      receivedMessages.push(msg);

      if (receivedMessages.length >= messagesToSend.length) {
        stream.end();
      }
    });

    stream.on('end', () => {
      logger.info({ totalReceived: receivedMessages.length }, 'Server ended duplex stream');
      console.log(`\nChat session completed. Total messages received: ${receivedMessages.length}\n`);
      client.close();
      resolve(receivedMessages);
    });

    stream.on('error', (err) => {
      if (err.code === grpc.status.CANCELLED) {
        client.close();
        resolve(receivedMessages);
        return;
      }
      logger.error({ code: err.code, details: err.details }, 'Duplex stream error');
      client.close();
      reject(err);
    });

    for (const text of messagesToSend) {
      console.log(`[${sender}] Sending: "${text}"`);
      stream.write({
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sender,
        text,
        room,
        timestamp: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
      });
    }
  });
}

if (require.main === module) {
  runClient()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = {
  createChatClient,
  runClient,
};
