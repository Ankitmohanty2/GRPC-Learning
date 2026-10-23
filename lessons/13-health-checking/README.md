# Lesson 13: Standard Health Checking (`grpc.health.v1`)

In this lesson, you will master the official **gRPC Health Checking Protocol** (`grpc.health.v1.Health`). You will learn how to report service readiness and liveness to Kubernetes, container orchestrators, and load balancers.

---

## 1. The Problem Being Solved

In cloud-native architectures:
- Load balancers (e.g. AWS ALB, Envoy, NGINX) need to know which pod instances are ready to accept traffic.
- Kubernetes probes need to detect when a pod has deadlocked (Liveness probe) or when a pod is warming up its database pool (Readiness probe).
- HTTP health checks (`GET /healthz`) require running a separate HTTP server on another port, complicating firewall and container rules.

The gRPC ecosystem defines a standard service contract: `grpc.health.v1.Health`. Any compliant orchestrator, proxy, or CLI tool (`grpc-health-probe`) can inspect the status of the entire server or individual microservice modules over the primary gRPC port.

---

## 2. Protocol Buffer Contract

File: `proto/grpc/health/v1/health.proto`

```protobuf
syntax = "proto3";

package grpc.health.v1;

message HealthCheckRequest {
  string service = 1;
}

message HealthCheckResponse {
  enum ServingStatus {
    UNKNOWN = 0;
    SERVING = 1;
    NOT_SERVING = 2;
    SERVICE_UNKNOWN = 3;
  }
  ServingStatus status = 1;
}

service Health {
  // Synchronous probe for liveness/readiness
  rpc Check(HealthCheckRequest) returns (HealthCheckResponse);

  // Streaming probe for real-time state changes
  rpc Watch(HealthCheckRequest) returns (stream HealthCheckResponse);
}
```

- An empty string `service = ""` inquires about the overall server process health.
- A specific service name (e.g. `service = "helloworld.Greeter"`) inquires about a specific subsystem.

---

## 3. Kubernetes Integration Example

In your Kubernetes Pod deployment manifest:

```yaml
livenessProbe:
  grpc:
    port: 50051
    service: ""
  initialDelaySeconds: 5
  periodSeconds: 10
readinessProbe:
  grpc:
    port: 50051
    service: "helloworld.Greeter"
  periodSeconds: 5
```

---

## 4. How to Run

```bash
npx tsx lessons/13-health-checking/client.ts
```

Using `grpcurl`:
```bash
grpcurl -plaintext -d '{"service": ""}' 127.0.0.1:50064 grpc.health.v1.Health/Check
```

---

## 5. Expected Output

```
--- 1. Probing Overall Server Health ---
Server Health: SERVING

--- 2. Probing Greeter Service Health ---
Greeter Service Health: SERVING
```

---

## 6. Common Mistakes

1. **Returning `OK` when downstream database is disconnected**:
   A readiness probe should verify that the service's critical dependencies (Postgres, Redis) are reachable. If the database connection is severed, set status to `NOT_SERVING` so the load balancer stops routing user requests to that failing pod.
2. **Confusing Liveness with Readiness**:
   - **Liveness probe failure**: Kubernetes restarts the pod (kill container).
   - **Readiness probe failure**: Kubernetes stops sending traffic to the pod, but leaves it running to recover (e.g. while a database reconnects).
3. **Hardcoding health checks to always return true**:
   A static health check that always returns `SERVING` without verifying internal health provides zero protection against deadlocks or resource exhaustion.

---

## 7. Exercises

1. **Watch Method**: Use `client.watch({ service: 'helloworld.Greeter' })` to subscribe to real-time status transitions as the server toggles between `SERVING` and `NOT_SERVING`.
2. **Graceful Shutdown Integration**: In your SIGTERM handler, set all services to `NOT_SERVING`, sleep 10 seconds (giving Kubernetes time to update endpoints), and then call `server.tryShutdown()`.

---

## 8. Interview Questions with Answers

### Q1: Why is an empty string `""` used in `HealthCheckRequest.service`?
**Answer**:
By standard convention in the gRPC Health Checking Protocol, an empty string queries the health of the entire server process overall. If the overall process is healthy, it returns `SERVING`. If individual services (e.g. PaymentService) degrade while UserService remains healthy, querying specific service names will return `NOT_SERVING` while the process itself stays alive.

### Q2: What status code should `Check` return if a queried service is not registered on the server?
**Answer**:
According to the official gRPC specification, if the requested service name is completely unknown to the health implementation, the server should return a gRPC `NOT_FOUND (code 5)` error rather than returning `SERVICE_UNKNOWN` inside the response body.
