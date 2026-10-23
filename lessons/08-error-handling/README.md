# Lesson 08: Error Handling and Status Codes

In this lesson, you will master the 16 canonical gRPC status codes, learn how to attach rich structured metadata to errors, and implement safe error sanitization that protects sensitive infrastructure details from leaking to callers.

---

## 1. The Problem Being Solved

In HTTP REST APIs, developers often misuse HTTP status codes (e.g. returning HTTP 200 with `{ "error": true }`, or throwing uncaught 500 Internal Server Errors containing full database credentials and stack traces).

In naive gRPC:
- Throwing an unhandled JavaScript `throw new Error(...)` causes `@grpc/grpc-js` to return `UNKNOWN (code 2)` with a blank or truncated message.
- Internal database errors like `connection refused at postgres.internal:5432` leak topology and credentials directly to clients.
- Clients cannot distinguish between permanent validation errors (which should never be retried) and transient server overloads (which should be retried with exponential backoff).

---

## 2. The 16 Canonical gRPC Status Codes

| Code | Name | HTTP Equivalent | Retryable? | Meaning |
|---|---|---|---|---|
| 0 | `OK` | 200 | No | Success |
| 1 | `CANCELLED` | 499 | No | Client aborted request |
| 2 | `UNKNOWN` | 500 | No | Unhandled server error |
| 3 | `INVALID_ARGUMENT` | 400 | No | Malformed payload / validation failure |
| 4 | `DEADLINE_EXCEEDED` | 504 | Yes | Timeout expired before completion |
| 5 | `NOT_FOUND` | 404 | No | Entity does not exist |
| 6 | `ALREADY_EXISTS` | 409 | No | Duplicate entity (e.g. email in use) |
| 7 | `PERMISSION_DENIED` | 403 | No | Authenticated but lacks required role |
| 8 | `RESOURCE_EXHAUSTED` | 429 | Yes | Rate limit or quota exceeded |
| 9 | `FAILED_PRECONDITION`| 400 | No | System not in correct state for action |
| 10 | `ABORTED` | 409 | Yes | Transaction conflict (safe to retry) |
| 11 | `OUT_OF_RANGE` | 400 | No | Beyond bounds (e.g. paging past end) |
| 12 | `UNIMPLEMENTED` | 501 | No | RPC method not supported |
| 13 | `INTERNAL` | 500 | No | Server bug or system invariant violated |
| 14 | `UNAVAILABLE` | 503 | Yes | Transient network or server reboot |
| 15 | `DATA_LOSS` | 500 | No | Irrecoverable data loss |
| 16 | `UNAUTHENTICATED` | 401 | No | Missing or invalid auth credentials |

---

## 3. Returning Rich Structured Error Metadata

In `@grpc/grpc-js`, pass `grpc.Metadata` into the error callback:

```typescript
const meta = new grpc.Metadata();
meta.set('x-field-name', 'email');
meta.set('x-constraint', 'invalid_domain');
meta.set('retry-after-ms', '5000');

callback({
  code: grpc.status.INVALID_ARGUMENT,
  details: 'Email domain is blocked',
  metadata: meta,
});
```

On the client side:
```typescript
client.createUser(payload, (err, res) => {
  if (err) {
    const field = err.metadata?.get('x-field-name')[0];
    const retryAfter = err.metadata?.get('retry-after-ms')[0];
    console.error(`Error on field ${field}. Retry after ${retryAfter}ms`);
  }
});
```

---

## 4. How to Run

```bash
npx tsx lessons/08-error-handling/client.ts
```

---

## 5. Expected Output

```
--- 1. Validation Error with Metadata ---
[INVALID_ARGUMENT] Field "name" must be at least 2 characters
Metadata: {
  'x-error-domain': 'validation',
  'x-field-name': 'name',
  'x-constraint': 'min_length_2'
}

--- 2. Rate Limit Error with Retry-After ---
[RESOURCE_EXHAUSTED] Rate limit quota exceeded. Please back off.
Retry after: 5000 ms

--- 3. Internal Error Sanitization ---
[INTERNAL] An internal error occurred. Please contact support with request ID.
Raw DB credentials leaked?: ✅ SECURE (Sanitized)
```

---

## 6. Common Mistakes

1. **Returning code 2 (`UNKNOWN`) for everything**:
   If your server catches an error and does not specify a valid `grpc.status`, the client has no way to programmatically determine whether the failure was user error or a server crash.
2. **Leaking Sensitive SQL Queries**:
   Never pass raw `err.message` from PostgreSQL, MongoDB, or Redis back to the client. Log the raw error with full stack traces in your structured logger, and return a sanitized message to the client.
3. **Using string status codes instead of numeric enums**:
   Always reference `grpc.status.NOT_FOUND`, not `"NOT_FOUND"`. In gRPC wire framing, status codes are integers.

---

## 7. Exercises

1. **Google RPC Status (Rich Errors)**: Research `google.rpc.Status` with `google.protobuf.Any`. How would you pack multiple field violations into a single binary protobuf error detail?
2. **Status Mapper**: Create a helper function that takes an unknown error and automatically maps `ZodError` to `INVALID_ARGUMENT` and database foreign key errors to `FAILED_PRECONDITION`.

---

## 8. Interview Questions with Answers

### Q1: What is the difference between `UNAUTHENTICATED` (16) and `PERMISSION_DENIED` (7)?
**Answer**:
- `UNAUTHENTICATED` indicates that the client has not provided valid credentials (e.g. missing, expired, or invalid JWT token). It corresponds to HTTP 401 Unauthorized.
- `PERMISSION_DENIED` indicates that the client is authenticated, but their identity or role does not have the necessary permissions to access the requested resource (e.g. standard user attempting to delete a tenant). It corresponds to HTTP 403 Forbidden.

### Q2: Why is `FAILED_PRECONDITION` different from `INVALID_ARGUMENT`?
**Answer**:
- `INVALID_ARGUMENT` means the client's request message is inherently invalid regardless of system state (e.g. an email missing the `@` symbol or a negative quantity).
- `FAILED_PRECONDITION` means the request syntax is valid, but the system's current state rejects the operation (e.g. attempting to delete a directory that is not empty, or attempting to complete an order that is already cancelled).
