# gRPC Learning Roadmap: From Beginner to Production Specialist

## Stage 1: Fundamentals & Protocol Buffers (Lessons 01 - 03)
- **Goal**: Understand why gRPC exists, how HTTP/2 multiplexing works, and write strict `.proto` contracts.
- **Key Concepts**:
  - Binary serialization vs JSON text.
  - Proto3 scalar types, enums, repeated fields, maps, and `oneof`.
  - Schema evolution, reserved tags, and wire compatibility.
  - Dynamic loading via `@grpc/proto-loader`.
- **Lessons**:
  - [Lesson 01: gRPC Fundamentals](../lessons/01-grpc-fundamentals/README.md)
  - [Lesson 02: Protocol Buffers](../lessons/02-protocol-buffers/README.md)
  - [Lesson 03: Unary RPC Pattern](../lessons/03-unary-rpc/README.md)

---

## Stage 2: Streaming Patterns & Backpressure (Lessons 04 - 06)
- **Goal**: Master all three streaming communication patterns in Node.js.
- **Key Concepts**:
  - Server streaming (real-time notification pushes, event feeds).
  - Client streaming (chunked file uploads, sensor batching).
  - Bidirectional streaming (interactive chat, collaborative feeds).
  - Stream lifecycle events (`data`, `end`, `error`, `cancelled`).
- **Lessons**:
  - [Lesson 04: Server Streaming](../lessons/04-server-streaming/README.md)
  - [Lesson 05: Client Streaming](../lessons/05-client-streaming/README.md)
  - [Lesson 06: Bidirectional Streaming](../lessons/06-bidirectional-streaming/README.md)

---

## Stage 3: Reliability, Security & Observability (Lessons 07 - 15)
- **Goal**: Build resilient distributed RPC services that survive network partitions and high traffic.
- **Key Concepts**:
  - Client deadlines and server deadline propagation.
  - Standard status codes and error propagation.
  - Interceptors for structured logging, metrics, and correlation IDs.
  - JWT authentication and Bearer token metadata.
  - TLS encryption with X.509 certificates.
  - Exponential backoff retries with jitter and idempotency checking.
  - Standard health checking protocol (`grpc.health.v1.Health`).
  - Server reflection and debugging with `grpcurl`.
  - Client-side round-robin load balancing.
- **Lessons**:
  - [Lesson 07: Deadlines & Timeouts](../lessons/07-deadlines-and-timeouts/README.md)
  - [Lesson 08: Error Handling](../lessons/08-error-handling/README.md)
  - [Lesson 09: Metadata & Interceptors](../lessons/09-metadata-and-interceptors/README.md)
  - [Lesson 10: Authentication & Authorization](../lessons/10-authentication-and-authorization/README.md)
  - [Lesson 11: TLS & Security](../lessons/11-tls-and-security/README.md)
  - [Lesson 12: Cancellation & Retries](../lessons/12-cancellation-and-retries/README.md)
  - [Lesson 13: Health Checking](../lessons/13-health-checking/README.md)
  - [Lesson 14: Reflection & Debugging](../lessons/14-reflection-and-debugging/README.md)
  - [Lesson 15: Load Balancing](../lessons/15-load-balancing/README.md)

---

## Stage 4: Enterprise Microservices & Operations (Lessons 16 - 21)
- **Goal**: Architect, test, and deploy integrated multi-service systems.
- **Key Concepts**:
  - gRPC vs REST performance benchmarking.
  - Database persistence layer integration.
  - Integrated microservices (`grpc-commerce-demo` with User, Product, and Order services).
  - Automated testing with Jest on dynamic ports.
  - Docker Compose containerization and Kubernetes readiness/liveness.
  - Production hardening checklist (keepalives, payload caps, graceful drain).
- **Lessons**:
  - [Lesson 16: REST vs gRPC Benchmark](../lessons/16-rest-vs-grpc/README.md)
  - [Lesson 17: Database Integration](../lessons/17-database-integration/README.md)
  - [Lesson 18: Integrated Microservices](../lessons/18-microservices/README.md)
  - [Lesson 19: Automated Testing](../lessons/19-testing/README.md)
  - [Lesson 20: Docker & Deployment](../lessons/20-docker-and-deployment/README.md)
  - [Lesson 21: Production Best Practices](../lessons/21-production-best-practices/README.md)
