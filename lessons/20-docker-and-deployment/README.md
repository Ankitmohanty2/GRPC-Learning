# Lesson 20: Docker Containerization & Production Deployment

## 1. Overview

Deploying gRPC services to production differs significantly from standard HTTP/1.1 web applications:
- **HTTP/2 Long-Lived Multiplexed Connections**: Standard L4 (TCP) load balancers route the entire connection to a single container instance, leaving other instances idle.
- **Health Probing**: gRPC requires binary health checking via the `grpc.health.v1.Health` protocol rather than HTTP GET `/healthz`.
- **ALPN / TLS Negotiation**: Secure gRPC requires HTTP/2 cleartext (H2C) internally or TLS with ALPN `h2`.

---

## 2. Docker Setup

The project includes a multi-service Docker Compose topology in `docker/docker-compose.yml`:
- `user-service`: Running on port `50051`
- `product-service`: Running on port `50052`
- `order-service`: Running on port `50053`
- `postgres`: Persistent database container

### Commands

Start all containers in detached mode:
```bash
npm run docker:up
```
*(Or directly: `docker compose -f docker/docker-compose.yml up -d`)*

Stop all containers:
```bash
npm run docker:down
```

Verify running containers:
```bash
docker compose -f docker/docker-compose.yml ps
```

---

## 3. Kubernetes Deployment & Health Probing

In Kubernetes, standard HTTP liveness probes cannot communicate over HTTP/2 gRPC. Instead, use the official `grpc-health-probe` utility or native Kubernetes gRPC probes (Kubernetes 1.24+):

```yaml
livenessProbe:
  grpc:
    port: 50051
    service: users.v1.UserService
  initialDelaySeconds: 5
  periodSeconds: 10
readinessProbe:
  grpc:
    port: 50051
    service: users.v1.UserService
  initialDelaySeconds: 2
  periodSeconds: 5
```

---

## 4. Reverse Proxying with Envoy or NGINX

Because browser JavaScript cannot speak raw HTTP/2 framing with trailers directly, browser clients connect via **gRPC-Web** through an Envoy proxy:
- Envoy terminates HTTP/1.1 or HTTP/2 gRPC-Web from the browser.
- Envoy converts it to native gRPC over HTTP/2 for backend Node.js microservices.
- Envoy performs Layer 7 request-level load balancing across backend pods.
