# gRPC & Distributed Systems Glossary

| Term | Definition |
| :--- | :--- |
| **ALPN (Application-Layer Protocol Negotiation)** | A TLS extension that allows the client and server to negotiate the protocol (such as `h2` for HTTP/2) during the TLS handshake before data transmission. |
| **Backpressure** | Flow-control signaling that prevents a fast sender from overwhelming a slower receiver's memory buffer in streaming RPCs. |
| **Bidirectional Streaming** | An RPC pattern where both client and server write independent message streams over a single HTTP/2 connection concurrently. |
| **Channel** | A gRPC abstraction representing an active connection to an endpoint. Channels multiplex calls, manage connection pools, reconnect automatically, and handle keepalive pings. |
| **Client Streaming** | An RPC pattern where the client writes a sequence of messages and the server responds once upon stream termination. |
| **Deadline** | A specific absolute timestamp before which an RPC must terminate. If the deadline expires before completion, the call aborts with `DEADLINE_EXCEEDED`. |
| **Field Number** | The unique integer assigned to each field in a `.proto` message. The wire format encodes this integer rather than field names. |
| **Graceful Shutdown** | Stopping a server by rejecting new incoming requests while allowing ongoing in-flight RPCs to finish within a timeout. |
| **gRPC-Web** | A protocol specification allowing modern web browser JavaScript clients to invoke gRPC services via an intermediary translation proxy (such as Envoy). |
| **Idempotency** | The property where an operation produces the identical outcome whether executed once or repeatedly (e.g., replaying with an `idempotency_key`). |
| **Interceptor** | Middleware for gRPC that wraps outbound client calls or inbound server handlers to add logging, authentication, tracing, or metrics. |
| **Metadata** | Key-value data transmitted alongside an RPC call in HTTP/2 headers or trailers, used for authorization tokens, correlation IDs, and tracing contexts. |
| **Multiplexing** | The ability of HTTP/2 to interleave multiple concurrent requests and responses over a single underlying TCP connection simultaneously. |
| **oneof** | A Protobuf definition indicating that at most one field from a group may be populated at any given time, saving wire memory. |
| **Reflection** | A standardized gRPC service allowing external tools (like `grpcurl`) to dynamically inspect service definitions and schemas at runtime. |
| **Server Streaming** | An RPC pattern where the client sends a single request and the server responds with a stream of multiple messages over time. |
| **Status Code** | An integer code (0-16) indicating the outcome of an RPC (e.g., `OK`, `CANCELLED`, `INVALID_ARGUMENT`, `NOT_FOUND`, `UNAVAILABLE`). |
| **Stub** | The client-side proxy object exposing local callable functions that correspond to remote methods defined in the `.proto` contract. |
| **Trailers** | Key-value metadata sent at the very end of an HTTP/2 response stream after all data frames have completed, delivering the `grpc-status` code. |
| **Unary RPC** | The simplest RPC communication pattern: the client sends one request message and the server sends one response message. |
