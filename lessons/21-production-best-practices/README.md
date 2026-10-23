# Lesson 21: Production Best Practices & Hardening

## 1. Overview

Running gRPC in mission-critical production environments requires adhering to reliability, security, and performance patterns that go beyond basic request/response handling.

This lesson details the production hardening checklist implemented in `lessons/21-production-best-practices/production-server.js`.

---

## 2. Production Checklist

### 1. Reuse gRPC Client Instances
**Anti-pattern**: Creating `new UserService(addr)` inside every incoming HTTP handler or function invocation.
**Production standard**: Initialize gRPC clients once at process boot and reuse them across requests. gRPC channels multiplex concurrent calls over a single underlying HTTP/2 connection. Creating a new client per request causes TCP handshakes, TLS negotiation overhead, and socket starvation.

### 2. Configure Keepalive Pings
Without keepalive pings, intermediate firewalls, NAT gateways, or cloud load balancers (such as AWS NLB) silently drop idle TCP connections after 350 seconds.
```javascript
const CHANNEL_OPTIONS = {
  'grpc.keepalive_time_ms': 30000,
  'grpc.keepalive_timeout_ms': 10000,
  'grpc.keepalive_permit_without_calls': 1,
  'grpc.http2.min_ping_interval_without_data_ms': 10000,
};
```

### 3. Set Maximum Message Limits
By default, gRPC restricts message size (default 4MB) to prevent memory exhaustion from oversized payloads. Never arbitrarily set this to `Infinity`:
```javascript
'grpc.max_receive_message_length': 4 * 1024 * 1024,
'grpc.max_send_message_length': 4 * 1024 * 1024,
```

### 4. Implement Graceful Drain & Shutdown
During rolling updates or deployments, container orchestrators send `SIGTERM`. The server must stop accepting new calls, complete in-flight RPCs, and gracefully drain connections within a timeout before falling back to `forceShutdown()`:
```javascript
server.tryShutdown((err) => {
  if (err) server.forceShutdown();
  process.exit(0);
});
```

### 5. Always Enforce Client Deadlines
Every outbound RPC must specify a deadline. Without deadlines, a downstream slowdown or frozen network partition causes upstream client requests to hang indefinitely, tying up memory and sockets.

### 6. Standard Health Checking & Reflection
- Register `grpc.health.v1.Health` for container liveness and readiness.
- Gate gRPC reflection behind environment checks (`NODE_ENV !== 'production'`) or internal networks to prevent unauthorized external schema discovery.

---

## 3. Running the Hardened Production Server

```bash
node lessons/21-production-best-practices/production-server.js
```

Press `Ctrl+C` to test graceful shutdown behavior and observe the structured drain logs.
