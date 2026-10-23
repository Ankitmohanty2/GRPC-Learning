# Lesson 16: REST vs gRPC

In this lesson, you will run a side-by-side benchmark comparing an Express.js HTTP/1.1 REST API against a gRPC HTTP/2 service.

---

## 1. Architectural Comparison

| Dimension | REST + JSON | gRPC + Protocol Buffers |
|---|---|---|
| **Protocol** | HTTP/1.1 (typically) | HTTP/2 (always) |
| **Data Format** | Human-readable ASCII JSON | Binary-encoded Varints / Length-delimited bytes |
| **Contract** | Loose / Documentation / OpenAPI | Strict `.proto` contract enforced on wire |
| **Connection** | New TCP connection or Keep-Alive pool | Single multiplexed persistent TCP connection |
| **Streaming** | Request/Response, SSE (unidirectional) | Full Bidirectional Streaming (4 RPC patterns) |
| **Performance** | High JSON serialization/deserialization CPU | Ultra-fast binary parsing (~5-10x faster) |
| **Browser Support**| Universal | Requires gRPC-Web proxy (Envoy) |

---

## 2. When to Use REST vs gRPC

### Choose REST when:
- Building public-facing external APIs consumed directly by third-party browser clients or mobile apps without code generation.
- Human inspectability via curl in web dev tools without reflection is required.
- Standard HTTP caching (e.g. `Cache-Control`, CDNs like Cloudflare) is needed.

### Choose gRPC when:
- East-West microservice-to-microservice communication within your cluster.
- Real-time bidirectional streaming (chat, financial tick feeds, IoT telemetry).
- Low latency, high throughput environments with millions of requests per second.
- Polyglot backend teams needing strictly typed contracts across Node.js, Go, Java, Python, C++.

---

## 3. How to Run Benchmark

```bash
npm run lesson:16:compare
```

Expected Output:
```
BENCHMARK: Express REST (JSON) vs gRPC (Protobuf)
Payload Size (JSON string):      132 bytes
Estimated Protobuf Binary Size:  ~48 bytes (~60% smaller)
Requests executed:               50 sequential calls
gRPC Total Duration:             ~25-40 ms
REST Total Duration:             ~70-120 ms
```
