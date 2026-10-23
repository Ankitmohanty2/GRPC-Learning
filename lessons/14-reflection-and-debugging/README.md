# Lesson 14: Reflection and Debugging

In this lesson, you will master **gRPC Server Reflection** (`@grpc/reflection`). You will learn how clients and CLI tools like `grpcurl` query servers at runtime for service schemas, enabling debugging and API inspection without local `.proto` files.

---

## 1. The Problem Being Solved

In traditional REST APIs:
- Developers use OpenAPI/Swagger UI to inspect available endpoints and schemas.
In gRPC:
- Binary protobuf messages cannot be interpreted without their `.proto` schema.
- Distributing `.proto` files to QA engineers or developers inspecting staging services creates friction and version drift.

gRPC solves this with the **Server Reflection Protocol**:
- The server exposes a meta-service: `grpc.reflection.v1alpha.ServerReflection`.
- `grpcurl`, Postman, and Insomnia query this service at runtime to discover services, methods, and types dynamically.

---

## 2. Implementation Details

```javascript
const { ReflectionService } = require('@grpc/reflection');

const reflection = new ReflectionService(packageDefinition);
reflection.addToServer(server);
```

---

## 3. How to Run & Use with grpcurl

Start the server:
```bash
npm run lesson:14:demo
```

In another terminal, use `grpcurl`:
```bash
# List all exposed services
grpcurl -plaintext 127.0.0.1:50064 list

# Describe a specific service contract
grpcurl -plaintext 127.0.0.1:50064 describe helloworld.Greeter

# Invoke method
grpcurl -plaintext -d '{"name": "Alice"}' 127.0.0.1:50064 helloworld.Greeter/SayHello
```

---

## 4. Expected Output

```
Server Reflection running on 127.0.0.1:50064
You can now inspect this server with grpcurl:
  grpcurl -plaintext 127.0.0.1:50064 list
  grpcurl -plaintext 127.0.0.1:50064 describe helloworld.Greeter
  grpcurl -plaintext -d "{\"name\":\"Alice\"}" 127.0.0.1:50064 helloworld.Greeter/SayHello
```

---

## 5. Exercises

1. **Production Security Check**: Disable reflection when `NODE_ENV === 'production'` to prevent external reconnaissance.
2. **Postman gRPC Inspection**: Open Postman, select gRPC Request, point to `127.0.0.1:50064`, select "Use Server Reflection", and invoke `SayHello`.
