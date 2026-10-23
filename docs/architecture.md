# Architecture Guide: gRPC in Pure Node.js

## 1. High-Level Architecture

gRPC is an open-source, high-performance Remote Procedure Call (RPC) framework developed by Google. In this project, gRPC is implemented in **pure Node.js using JavaScript CommonJS (`require`/`module.exports`)** without any compilation or TypeScript build step.

```mermaid
graph TD
    subgraph Client ["Node.js gRPC Client"]
        App[Business Logic]
        Interceptors[Client Interceptors<br/>Logging / Auth / Retries]
        Stub[gRPC Stub / Dynamic Client]
    end

    subgraph Transport ["HTTP/2 Connection (Multiplexed)"]
        Stream1[Stream 1: Unary RPC]
        Stream2[Stream 2: Server Streaming]
        Stream3[Stream 3: Bidirectional Streaming]
    end

    subgraph Server ["Node.js gRPC Server"]
        Listener[gRPC Server Listener]
        Handlers[RPC Handlers<br/>Unary / Streaming]
        Health[Health & Reflection Services]
        Repo[In-Memory / Database Repo]
    end

    App --> Interceptors --> Stub
    Stub --> Stream1 & Stream2 & Stream3
    Stream1 & Stream2 & Stream3 --> Listener
    Listener --> Handlers
    Handlers --> Repo
    Listener --> Health
```

---

## 2. HTTP/2 Wire Protocol & Multiplexing

Unlike HTTP/1.1 which requires a separate TCP connection or pipelining for parallel requests, gRPC utilizes HTTP/2 over a single persistent TCP connection:

- **Binary Framing**: Protocol Buffers serialize JavaScript objects into compact binary frames rather than ASCII JSON.
- **Streams & Multiplexing**: Thousands of concurrent RPC calls are multiplexed across bidirectional streams on one connection.
- **HTTP Headers & Trailers**:
  - Request headers transmit call metadata (e.g., `authorization`, `x-correlation-id`).
  - Response trailers transmit the final gRPC status code (`grpc-status: 0`) and execution metadata after the response message body is transferred.

---

## 3. Dynamic Protocol Buffer Loading Pipeline

Instead of static code generation that requires external CLI tools (`protoc`), this repository employs dynamic loading:

```mermaid
flowchart LR
    ProtoFile[".proto Contract File"] --> ProtoLoader["@grpc/proto-loader<br/>loadSync()"]
    ProtoLoader --> PackageDef["Package Definition (AST)"]
    PackageDef --> GrpcObject["@grpc/grpc-js<br/>loadPackageDefinition()"]
    GrpcObject --> ServiceConstructor["Dynamic Client / Server Stub"]
```

Options configured in `src/common/proto-loader.js`:
- `keepCase: true`: Preserves snake_case field names from `.proto` definitions.
- `longs: String`: Prevents 64-bit integer precision loss in JavaScript by representing `int64` as strings.
- `enums: String`: Decodes enum wire values into string literals for clarity.
- `defaults: true`: Populates missing proto fields with their type default values.
- `oneofs: true`: Includes active oneof field identifiers on decoded objects.

---

## 4. Microservices Topology (`grpc-commerce-demo`)

```mermaid
flowchart TD
    Client[Client / Gateway] -->|createOrder| OrderService[Order Service :50053]
    OrderService -->|getUser| UserService[User Service :50051]
    OrderService -->|validateStock| ProductService[Product Service :50052]
```

- **Separation of Concerns**: Each microservice is an autonomous Node.js process with its own domain logic, port, and health check.
- **Resilience**: The Order Service implements timeouts, client-side retry with backoff, and idempotent deduplication.
