# Lesson 12: Cancellation and Retries

In this lesson, you will master resilience patterns in gRPC: client-side request cancellation, aborting server background work when a client cancels, and designing robust retry policies with **Exponential Backoff and Jitter** while respecting idempotency.

---

## 1. The Problem Being Solved

In high-scale distributed systems:
- Transient errors happen constantly: pod deployments, network blips, TCP timeouts, or database connection pool resets.
- Blindly retrying every failed request causes **retry storms (thundering herds)** that can permanently crash recovering services.
- Retrying non-idempotent operations (such as `ChargeCreditCard`) can cause duplicate billing or corrupt state.
- If a client closes their browser or app, continuing expensive background work on the server wastes database connections and compute.

---

## 2. Exponential Backoff and Jitter

When retrying, never use a static delay (e.g. `sleep(1000)`). If 1,000 clients all fail at 12:00:00, all 1,000 clients will hammer the recovering server simultaneously at 12:00:01.

Formula:
$$\text{delay} = \min(\text{initialBackoff} \times \text{multiplier}^{\text{attempt}}, \text{maxBackoff}) \times (1 \pm \text{jitter})$$

Jitter randomizes the delay (e.g. $\pm 20\%$), desynchronizing the incoming retry waves.

---

## 3. Which Status Codes are Safe to Retry?

| Status Code | Safe to Retry? | Notes |
|---|---|---|
| `UNAVAILABLE` (14) | ✅ Yes | Transient network or node restart |
| `DEADLINE_EXCEEDED` (4) | ⚠️ Conditional | Only if the operation is strictly idempotent |
| `RESOURCE_EXHAUSTED` (8)| ⚠️ Conditional | Respect `retry-after-ms` metadata |
| `INVALID_ARGUMENT` (3) | ❌ Never | Client payload is malformed |
| `NOT_FOUND` (5) | ❌ Never | Resource does not exist |
| `ALREADY_EXISTS` (6) | ❌ Never | Entity already created |
| `PERMISSION_DENIED` (7)| ❌ Never | Auth problem |

---

## 4. Implementation Details

### Client Cancellation
```typescript
const call = client.sayHello({ name: 'long_task' });

// Abort after 500ms
setTimeout(() => {
  call.cancel();
}, 500);
```

### Server Handling Cancellation
```typescript
function sayHello(call, callback) {
  const timer = setTimeout(() => {
    callback(null, { message: 'Done' });
  }, 10000);

  call.on('cancelled', () => {
    console.warn('Client cancelled — stopping work');
    clearTimeout(timer);
  });
}
```

---

## 5. How to Run

```bash
npx tsx lessons/12-cancellation-and-retries/client.ts
```

---

## 6. Expected Output

```
--- 1. Testing Resilient Call with Exponential Backoff ---
✅ Result: Success on attempt #3, flaky_user!

--- 2. Testing Client-Side Call Cancellation ---
🛑 Client calling call.cancel()
✅ Cancellation test completed
```

---

## 7. Exercises

1. **Idempotency Keys**: Add an `idempotency_key` field to a mutation RPC. Cache the result in a local `Map`. If a client retries with the same key, return the cached result without re-executing.
2. **Circuit Breaker**: Combine retries with an in-memory Circuit Breaker: if 5 consecutive calls fail with `UNAVAILABLE`, enter the `OPEN` state and fail fast for 10 seconds.

---

## 8. Interview Questions with Answers

### Q1: Why is retrying `DEADLINE_EXCEEDED` dangerous for non-idempotent RPCs?
**Answer**:
A deadline can expire after the server successfully completed the mutation (e.g. database commit), but before the response reached the client over the network. If the client retries an operation like `CreateOrder` or `TransferFunds`, the server may execute the mutation a second time unless an idempotency key is enforced.

### Q2: How does gRPC cancellation propagate across multiple service hops?
**Answer**:
When a client calls `call.cancel()`, an HTTP/2 `RST_STREAM` frame is sent immediately to the intermediate service. If that service is properly listening to `call.on('cancelled')`, it immediately cancels all downstream RPCs it originated on behalf of that request, stopping wasted computation across the entire call tree.
