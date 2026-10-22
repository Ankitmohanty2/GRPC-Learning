# GRPC-Learning

A personal learning space for **gRPC** (Google Remote Procedure Call) — the contract-first RPC framework that pairs a Protocol Buffers IDL with HTTP/2 to give you typed, fast, streaming service calls.

This repository is a notebook: every example is small, self-contained, and written to be read as much as run. The goal is not to ship a production service, but to build an accurate mental model of how gRPC actually works — one concept at a time.

---

## Table of contents

- [What is gRPC?](#what-is-grpc)
- [Why gRPC?](#why-grpc)
- [The four kinds of RPC](#the-four-kinds-of-rpc)
- [Learning path](#learning-path)
- [Quick start](#quick-start)
- [Tooling reference](#tooling-reference)
- [Core concepts](#core-concepts)
- [Repository layout](#repository-layout)
- [Troubleshooting](#troubleshooting)
- [Resources](#resources)
- [Contributing](#contributing)
- [License](#license)

---

## What is gRPC?

gRPC is an RPC framework. You define a **service contract** in a `.proto` file, compile it, and the compiler generates a **server skeleton** and a **client stub** in your language. The generated code handles serialization, framing, deadlines, status codes, and streaming — you write the business logic.

The core loop is always the same:

```
.proto contract  →  protoc / buf generates code  →  you implement the service + call it
```

Because the contract is language-neutral, a Go server and a Node client can talk to each other with no hand-written glue.

## Why gRPC?

| | gRPC | REST / JSON |
|---|---|---|
| Contract | Typed `.proto`, versioned explicitly | Implicit, often documented in prose |
| Payload | Binary protobuf | Human-readable JSON |
| Streaming | First-class (all four RPC kinds) | Awkward; needs SSE or WebSockets |
| Call semantics | Built-in deadlines, cancellation, status codes | Hand-rolled |
| Browser support | Needs a proxy (`grpc-web`) | Native |

gRPC is a strong fit for internal service-to-service calls where both ends are under your control. It is a weaker fit for public APIs that need browser access or human-readable payloads.

## The four kinds of RPC

Every gRPC method is one of four shapes. This is the single most important thing to internalize:

```proto
// 1. Unary — one request, one response. Like a normal function call.
rpc SayHello (HelloRequest) returns (HelloResponse);

// 2. Server streaming — one request, many responses.
rpc ListFeatures (Rectangle) returns (stream Feature);

// 3. Client streaming — many requests, one response.
rpc RecordRoute (stream Point) returns (RouteSummary);

// 4. Bidirectional streaming — many requests, many responses, both sides
//    read and write independently.
rpc RouteChat (stream RouteNote) returns (stream RouteNote);
```

Message ordering is guaranteed within an individual call. In a bidi stream, the two directions are independent — the server can write before it has read everything.

## Learning path

Work through these in order. Each step builds on the last.

| # | Topic | What you learn |
|---|-------|----------------|
| 1 | **Hello World** | Define a service, generate code, run a server and client |
| 2 | **Proto3 basics** | Scalar types, `repeated`, `map`, `oneof`, `optional`, field evolution rules |
| 3 | **Server streaming** | `returns (stream ...)`, reading a server-sent sequence |
| 4 | **Client streaming** | `rpc ... (stream ...)`, writing a request sequence |
| 5 | **Bidirectional streaming** | Read/write concurrency, backpressure, flow control |
| 6 | **Deadlines & cancellation** | `deadline` option, `DEADLINE_EXCEEDED`, aborting in-flight calls |
| 7 | **Metadata** | Request/response headers, auth tokens, custom key-value pairs |
| 8 | **Error handling** | gRPC status codes, `grpc.ServiceError`, rich error details |
| 9 | **Interceptors** | Cross-cutting middleware on client and server |
| 10 | **Security** | TLS, per-RPC credentials, mTLS |
| 11 | **Reflection & tooling** | `grpcurl`, server reflection, `buf` lint and breaking-change detection |

## Quick start

The examples target **Node.js** with the pure-JavaScript `@grpc/grpc-js` implementation (no native compilation required).

### Prerequisites

- **Node.js 18 or newer** — check with `node --version`
- **npm 9 or newer** — ships with Node

### 1. Install the dependencies

```bash
npm install @grpc/grpc-js @grpc/proto-loader @grpc/reflection
```

| Package | Purpose |
|---|---|
| `@grpc/grpc-js` | The gRPC runtime for Node.js |
| `@grpc/proto-loader` | Loads `.proto` files at runtime (dynamic code generation) |
| `@grpc/reflection` | Server reflection, so `grpcurl` can discover services |

### 2. Define the service

Create `proto/helloworld.proto`:

```proto
syntax = "proto3";

package helloworld;

// The greeting service definition.
service Greeter {
  // Sends a greeting.
  rpc SayHello (HelloRequest) returns (HelloReply) {}
}

// The request message containing the user's name.
message HelloRequest {
  string name = 1;
}

// The response message containing the greetings.
message HelloReply {
  string message = 1;
}
```

Note the field numbers (`= 1`, `= 2`). They are the wire format's identity, not array indices — never renumber an existing field, and never reuse a number you've deleted.

### 3. Write the server

Create `src/server.js`:

```js
const path = require('node:path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { ReflectionService } = require('@grpc/reflection');

const PROTO_PATH = path.join(__dirname, '..', 'proto', 'helloworld.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const proto = grpc.loadPackageDefinition(packageDefinition).helloworld;

function sayHello(call, callback) {
  callback(null, { message: `Hello ${call.request.name}` });
}

const server = new grpc.Server();
server.addService(proto.Greeter.service, { sayHello });

const reflection = new ReflectionService(proto);
reflection.addToServer(server);

const PORT = process.env.PORT || '50051';
server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
  console.log(`Server listening on 0.0.0.0:${port}`);
});
```

The `protoLoader.loadSync` options control how protobuf values map to JavaScript. `keepCase: true` preserves `snake_case` field names as written in the `.proto` file instead of converting them to `camelCase` — it keeps the JavaScript side matching the contract.

### 4. Write the client

Create `src/client.js`:

```js
const path = require('node:path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = path.join(__dirname, '..', 'proto', 'helloworld.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const proto = grpc.loadPackageDefinition(packageDefinition).helloworld;

const client = new proto.Greeter(`127.0.0.1:${process.env.PORT || '50051'}`, grpc.credentials.createInsecure());

const name = process.argv[2] || 'world';

client.sayHello({ name }, (err, response) => {
  if (err) {
    console.error('RPC failed:', err.message);
    process.exit(1);
  }
  console.log('Greeting:', response.message);
  client.close();
});
```

### 5. Run it

Open two terminals:

```bash
# Terminal 1
node src/server.js
# Server listening on 0.0.0.0:50051

# Terminal 2
node src/client.js Alice
# Greeting: Hello Alice
```

### 6. Call it with grpcurl

[`grpcurl`](https://github.com/fullstorydev/grpcurl) is a `curl` for gRPC. Because the server registers the reflection service, it can discover the schema at runtime — no `.proto` file needed on the client side.

```bash
# List the services the server exposes
grpcurl -plaintext 127.0.0.1:50051 list
# helloworld.Greeter

# Inspect the service definition
grpcurl -plaintext 127.0.0.1:50051 describe helloworld.Greeter
# service Greeter {
#   rpc SayHello ( .helloworld.HelloRequest ) returns ( .helloworld.HelloReply );
# }

# Invoke the method
grpcurl -plaintext -d '{"name":"Bob"}' 127.0.0.1:50051 helloworld.Greeter/SayHello
# {
#   "message": "Hello Bob"
# }
```

Without reflection enabled, pass the contract instead:

```bash
grpcurl -plaintext -proto proto/helloworld.proto \
  -d '{"name":"Bob"}' 127.0.0.1:50051 helloworld.Greeter/SayHello
```

## Tooling reference

### protoc — the Protocol Buffers compiler

Install it from the [protobuf releases page](https://github.com/protocolbuffers/protobuf/releases) and make sure `protoc` is on your `PATH`.

```bash
protoc --version
# libprotoc 36.2
```

### Code generation: dynamic vs. static

Node.js gRPC has two ways to turn a `.proto` into code, and they are genuinely different tools.

**Dynamic** (what the quick start uses) — `@grpc/proto-loader` parses the `.proto` at runtime. No build step, no generated files in the repo, and the contract can change without regenerating anything. This is the recommended default for learning and for most Node.js services.

**Static** — `protoc` emits real `.js` files that you import. Faster at runtime and gives you a typed API without a load-time parse, at the cost of a codegen step in your build.

For static generation you need three pieces that must agree on the `google-protobuf` runtime version:

```bash
npm install @grpc/grpc-js google-protobuf@4.0.3
npm install --save-dev protoc-gen-js@4.0.3 protoc-gen-grpc-js@0.4.0
```

`protoc-gen-grpc-js` declares a peer dependency on `google-protobuf@^3.14.0`, so npm may need `--legacy-peer-deps` to install it alongside `google-protobuf@4`. A version mismatch between the generated code and the runtime shows up as `Error deserializing request` at call time, not at build time — so keep the pair pinned.

Then generate, pointing `protoc` at both plugins explicitly:

```bash
protoc \
  --plugin=protoc-gen-grpc=node_modules/.bin/protoc-gen-grpc-js \
  --plugin=protoc-gen-js=node_modules/.bin/protoc-gen-js \
  --js_out=import_style=commonjs,binary:./src/generated \
  --grpc_out=grpc_js:./src/generated \
  -I ./proto ./proto/helloworld.proto
```

This produces `src/generated/helloworld_pb.js` and `src/generated/helloworld_grpc_pb.js`. Import them like any other module:

```js
const grpc = require('@grpc/grpc-js');
const { HelloRequest } = require('./generated/helloworld_pb');
const { GreeterClient } = require('./generated/helloworld_grpc_pb');

const client = new GreeterClient('127.0.0.1:50051', grpc.credentials.createInsecure());

const request = new HelloRequest();
request.setName('Alice');

client.sayHello(request, (err, response) => {
  if (err) {
    console.error('RPC failed:', err.message);
    process.exit(1);
  }
  console.log('Greeting:', response.getMessage());
  client.close();
});
```

Note the difference in style: with static generation you build a message with `new HelloRequest()` and `setName()`, and you read it back with `getMessage()`. With dynamic generation you pass and receive plain objects.

Generated files are git-ignored in this repository — regenerate them locally rather than committing them.

### buf — a modern alternative to protoc

[`buf`](https://buf.build) is a protobuf toolchain that adds linting, breaking-change detection, and a managed registry.

```bash
# Install
brew install bufbuild/buf/buf        # macOS
# or download a release binary from https://github.com/bufbuild/buf/releases

buf --version
# 1.75.0
```

Useful commands once you have a `buf.yaml`:

```bash
buf lint          # enforce style rules
buf breaking --against '.git#branch=main'   # catch incompatible changes
buf generate      # generate code from buf.gen.yaml
```

### grpcurl — the command-line client

```bash
brew install grpcurl                  # macOS
# or: go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest
```

Useful flags:

| Flag | Purpose |
|---|---|
| `-plaintext` | Connect without TLS (local development only) |
| `-d '{"name":"Bob"}'` | Send a JSON request body |
| `-proto <file>` | Use a local `.proto` when reflection is off |
| `-format json\|text` | Response output format |
| `-max-time <secs>` | Client-side deadline in seconds |

## Core concepts

### Deadlines and cancellation

Every call can carry a deadline. When it passes, the call is cancelled and the server sees the context abort. This is how you avoid leaking a hung request forever.

```js
const deadline = new Date(Date.now() + 3000); // 3 seconds from now
client.sayHello({ name: 'Alice' }, { deadline }, (err, response) => {
  if (err) {
    console.error(err.code, err.details); // 4 = DEADLINE_EXCEEDED
    return;
  }
  console.log(response.message);
});
```

The server sees the deadline too, and can check `call.metadata` and abort early rather than doing work nobody will read.

### Metadata

Metadata is the gRPC equivalent of HTTP headers: a set of key-value pairs sent with a call.

```js
// Client: attach an auth token
const metadata = new grpc.Metadata();
metadata.set('authorization', 'Bearer ' + token);

client.sayHello({ name: 'Alice' }, metadata, (err, response) => { /* ... */ });
```

```js
// Server: read it inside the handler
function sayHello(call, callback) {
  const auth = call.metadata.get('authorization');
  if (!auth?.[0]?.startsWith('Bearer ')) {
    callback({ code: grpc.status.UNAUTHENTICATED, details: 'Missing token' });
    return;
  }
  callback(null, { message: `Hello ${call.request.name}` });
}
```

`metadata.get()` returns an **array** of values, and an empty array is truthy — so `!auth` does not detect a missing header. Use optional chaining (`auth?.[0]?....`) to check the first value safely.

Metadata keys are lowercase, and values are always strings (or buffers).

### Error handling

Errors are reported with a numeric **status code**, not an HTTP status. The important ones:

| Code | Name | Meaning |
|---|---|---|
| 0 | `OK` | Success |
| 3 | `INVALID_ARGUMENT` | The client sent something malformed |
| 5 | `NOT_FOUND` | The requested entity does not exist |
| 7 | `PERMISSION_DENIED` | The caller is not allowed to do this |
| 8 | `RESOURCE_EXHAUSTED` | A quota or rate limit was hit |
| 9 | `FAILED_PRECONDITION` | The system is not in a state that allows this |
| 12 | `UNIMPLEMENTED` | The method does not exist on this server |
| 13 | `INTERNAL` | Something broke on the server |
| 14 | `UNAVAILABLE` | The server could not be reached — retry may help |
| 4 | `DEADLINE_EXCEEDED` | The deadline passed |
| 1 | `CANCELLED` | The call was cancelled |

On the server, pass a structured error to the callback:

```js
callback({
  code: grpc.status.NOT_FOUND,
  details: `No user with id ${call.request.id}`,
});
```

On the client, the error is an object with a `code` (number), `details` (string), and `metadata`. In TypeScript it is typed as `grpc.ServiceError`; note that this is a type-only export, so `err instanceof grpc.ServiceError` does not work at runtime — compare `err.code` against `grpc.status.*` instead.

The distinction between `INVALID_ARGUMENT` (the request is wrong, don't retry) and `UNAVAILABLE` (the server is down, retry) is the one that matters most in practice.

### Interceptors

Interceptors are middleware. A server interceptor receives the method descriptor and the call, and returns a wrapped call built from a listener and a responder:

```js
function loggingInterceptor(methodDescriptor, call) {
  const started = Date.now();

  const listener = new grpc.ServerListenerBuilder()
    .withOnReceiveMessage((message, next) => {
      console.log(`server received: ${JSON.stringify(message)}`);
      next(message);
    })
    .build();

  const responder = new grpc.ResponderBuilder()
    .withStart(next => {
      next(listener);
    })
    .withSendMessage((message, next) => {
      console.log(`call took ${Date.now() - started}ms`);
      next(message);
    })
    .build();

  return new grpc.ServerInterceptingCall(call, responder);
}

const server = new grpc.Server({ interceptors: [loggingInterceptor] });
```

The `ServerListenerBuilder` intercepts what the server *receives*; the `ResponderBuilder` intercepts what it *sends*. Each `next(...)` call passes control along — forgetting it stalls the call.

Client interceptors use a different set of builders — `RequesterBuilder` for what the client sends, `ListenerBuilder` for what it receives:

```js
function authInterceptor(options, nextCall) {
  const requester = new grpc.RequesterBuilder()
    .withStart((metadata, listener, next) => {
      metadata.set('authorization', 'Bearer some-secret-token');
      next(metadata, listener);
    })
    .build();
  return new grpc.InterceptingCall(nextCall(options), requester);
}

const client = new proto.Greeter('127.0.0.1:50051', grpc.credentials.createInsecure(), {
  interceptors: [authInterceptor],
});
```

This is the natural place to attach an auth token to every outgoing call without threading it through the call sites.

## Repository layout

```
GRPC-Learning/
├── proto/            # .proto contracts, shared across examples
├── src/              # server and client code
├── examples/         # one directory per learning-path step
├── tools/            # helper scripts (codegen, formatting, linting)
└── README.md
```

### Conventions

- **One `.proto` per example**, in that example's own `proto/` directory — contracts should be readable in isolation.
- **Generated code is never committed.** Run the codegen command; the output is git-ignored.
- **Pin your `google-protobuf` version** in `package.json` if you use static code generation.

## Troubleshooting

**`EADDRNOTAVAIL` or the client can't reach the server**

Check that the server is actually listening, and that the client and server agree on the port. If your environment sets `PORT` to `0`, the server binds to a random port and your client's `50051` will never match — start the server with an explicit `PORT=50051`.

**`Error deserializing request` (static codegen)**

A version mismatch between the generated code and the `google-protobuf` runtime. Reinstall so that `protoc-gen-js`, `protoc-gen-grpc-js`, and `google-protobuf` all agree, then regenerate.

**`protoc-gen-grpc: program not found`**

`protoc` looks for plugins on your `PATH`. Either add `node_modules/.bin` to `PATH`, or pass `--plugin=protoc-gen-grpc=node_modules/.bin/protoc-gen-grpc-js` explicitly.

**`Failed to start server: listen EADDRINUSE`**

Another process holds the port. Find it with `lsof -i :50051` (macOS/Linux) or `netstat -ano | findstr :50051` (Windows), and stop it. Note that gRPC enables `SO_REUSEPORT`, so a stale server may silently share the port with a new one and produce confusing half-working behavior.

**`Cannot find module 'google-protobuf'`**

The static runtime is a separate package. Install it: `npm install google-protobuf@4.0.3`.

**`grpcurl` says "server does not support the reflection service"**

You did not register the reflection service, or you are using a server started without it. Either add the `@grpc/reflection` setup from the quick start, or pass `-proto proto/helloworld.proto` to `grpcurl`.

## Resources

- [gRPC documentation](https://grpc.io/docs/) — the official starting point
- [gRPC core concepts](https://grpc.io/docs/what-is-grpc/core-concepts/) — service definition, RPC lifecycle
- [gRPC Node basics tutorial](https://grpc.io/docs/languages/node/basics/) — the dynamic codegen path in detail
- [Protocol Buffers language guide](https://protobuf.dev/programming-guides/proto3/) — the `proto3` reference
- [`@grpc/grpc-js`](https://github.com/grpc/grpc-node) — the Node.js implementation
- [`grpcurl`](https://github.com/fullstorydev/grpcurl) — command-line gRPC client
- [`buf`](https://buf.build/docs) — linting, breaking-change detection, and a protobuf registry
- [Google API design guide](https://google.aip.dev) — conventions worth following for any RPC API

## Contributing

This is a personal learning repository, but contributions are welcome. If you add an example:

1. Put it in `examples/<NN>-<topic>/` and follow the numbering in the learning path.
2. Include a short `README.md` in the example directory explaining what it demonstrates and what to look for.
3. Make sure the example runs from a clean `npm install` — no undocumented global state.
4. Do not commit generated code.

## License

Released under the [MIT License](./LICENSE).

Copyright &copy; 2026 Ankit Mohanty.
