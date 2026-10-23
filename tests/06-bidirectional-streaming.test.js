const { startServer } = require('../lessons/06-bidirectional-streaming/server');
const { runClient, createChatClient } = require('../lessons/06-bidirectional-streaming/client');

describe('Lesson 06: Bidirectional Streaming (ChatService)', () => {
  let serverInstance;
  let boundPort;

  beforeAll(async () => {
    const result = await startServer(0, '127.0.0.1');
    serverInstance = result.server;
    boundPort = result.port;
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      serverInstance.tryShutdown(() => resolve());
    });
  });

  it('should send messages and receive immediate system acknowledgements', async () => {
    const received = await runClient(`127.0.0.1:${boundPort}`, 'Alice', 'general', [
      'Hello 1',
      'Hello 2',
    ]);

    expect(received.length).toBe(2);
    expect(received[0].sender).toBe('SystemBot');
    expect(received[0].text).toContain('Hello 1');
  });

  it('should broadcast messages between two clients connected to the same room', async () => {
    const clientA = createChatClient(`127.0.0.1:${boundPort}`);
    const clientB = createChatClient(`127.0.0.1:${boundPort}`);

    const streamA = clientA.chat();
    const streamB = clientB.chat();

    streamA.on('error', () => {});
    streamB.on('error', () => {});

    const receivedByB = [];

    streamB.on('data', (msg) => {
      receivedByB.push(msg);
    });

    streamB.write({
      id: 'init_b',
      sender: 'Bob',
      text: 'Joining room',
      room: 'gamers',
      timestamp: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
    });

    await new Promise((r) => setTimeout(r, 50));

    streamA.write({
      id: 'msg_a_1',
      sender: 'Alice',
      text: 'Good game everyone!',
      room: 'gamers',
      timestamp: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
    });

    await new Promise((r) => setTimeout(r, 100));

    const broadcastFromAlice = receivedByB.find(
      (m) => m.sender === 'Alice' && m.text === 'Good game everyone!',
    );
    expect(broadcastFromAlice).toBeDefined();

    streamA.end();
    streamB.end();
    clientA.close();
    clientB.close();
  });
});
