# Lesson 15: Load Balancing and Service Discovery

In this lesson, you will learn how load balancing works in gRPC, why traditional Layer 4 (TCP) load balancers fail with HTTP/2, and how to implement client-side and proxy-side (Envoy) load balancing.

---

## 1. The Core Problem: Why L4 Load Balancers Fail with gRPC

In HTTP/1.1 REST:
- Clients open a TCP connection, send a request, receive a response, and often close or cycle the connection.
- A Layer 4 (TCP) load balancer distributes incoming TCP connections evenly across backend instances.

In gRPC (HTTP/2):
- A client opens **ONE persistent TCP connection** to the server upon boot and keeps it open indefinitely.
- Thousands of concurrent RPC requests are multiplexed as independent streams over this single TCP connection.
- If you place an L4 TCP load balancer in front of gRPC backends:
  - Client 1 connects to Pod A.
  - Client 1 sends 10,000 requests/minute.
  - **All 10,000 requests go exclusively to Pod A!** Pod B and Pod C remain completely idle!

---

## 2. Solutions: Client-Side vs Proxy-Side (L7)

### A. Client-Side Load Balancing
The client resolves all available backend IP addresses (via DNS `A` records or service discovery like Consul/K8s headless services) and distributes requests across multiple connections using a policy such as `round_robin`.

### B. Proxy-Side Load Balancing (Envoy / L7 Gateway)
The client connects to an L7 proxy (e.g. Envoy, NGINX with HTTP/2 support, or AWS ALB). The proxy terminates the HTTP/2 connection and load-balances individual RPC requests across upstream backend pods.

---

## 3. How to Run

```bash
npm run lesson:15:demo
```

Expected Output:
```
Started 3 backend instances on ports: 50110, 50111, 50112

--- Distributing 6 RPC Requests Round-Robin ---
Request #1 -> Served by Backend Worker #1
Request #2 -> Served by Backend Worker #2
Request #3 -> Served by Backend Worker #3
Request #4 -> Served by Backend Worker #1
Request #5 -> Served by Backend Worker #2
Request #6 -> Served by Backend Worker #3
```

---

## 4. Exercises

1. **Failure Failover**: Simulate one worker instance crashing (`server.forceShutdown()`). Test how the client gracefully routes subsequent traffic to the remaining healthy instances.
2. **Weighted Balancing**: Implement a weighted round-robin distribution where Instance 1 receives 70% of traffic and Instance 2 receives 30%.
