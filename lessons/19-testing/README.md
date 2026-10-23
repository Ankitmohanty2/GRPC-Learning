# Lesson 19: Automated Testing for gRPC in Pure JavaScript

## 1. Overview

Testing distributed RPC systems requires validating contracts, wire serialization, error translation, and network lifecycles. Unlike HTTP/REST where `supertest` can directly hook into an Express listener without listening on a TCP socket, gRPC requires an actual HTTP/2 transport connection.

This repository uses **Jest** with pure JavaScript CommonJS for unit, integration, and streaming tests.

---

## 2. Key Testing Strategies

### A. Dynamic Port Binding (`127.0.0.1:0`)
Hardcoding ports like `50051` in tests creates collisions during parallel test runs or CI pipeline executions.
By binding to port `0`:
```javascript
server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (err, port) => {
  // OS assigns a free random port
});
```

### B. Clean Teardown
Always shut down servers and close clients in `afterAll` or `finally` blocks:
```javascript
client.close();
await new Promise((resolve) => server.tryShutdown(resolve));
```

### C. Testing Streaming RPCs with Jest Promises
Wrap stream event listeners (`data`, `end`, `error`) inside native Promises:
```javascript
const items = [];
await new Promise((resolve, reject) => {
  call.on('data', (chunk) => items.push(chunk));
  call.on('end', resolve);
  call.on('error', reject);
});
expect(items).toHaveLength(5);
```

---

## 3. Running Tests

### Run All 18 Test Suites:
```bash
npm test
```

### Run Only Microservices Integration Tests:
```bash
npm run test:integration
```

### Run the Standalone Programmatic Demo:
```bash
node lessons/19-testing/demo.js
```

Expected Output:
```
🧪 Running Programmatic gRPC Integration Test Suite...
1. Testing Unary Success Path...
   ✅ PASS: Expected message received
2. Testing Validation Failure Path...
   ✅ PASS: Received INVALID_ARGUMENT as expected

All in-memory gRPC programmatic tests passed successfully!
```
