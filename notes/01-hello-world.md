# 01 - Hello World

The first example: one service, one method, a server and a client, plus `grpcurl`
for a look at the contract without the source.

## What I expected

- `npm install` of three packages and `node src/server.js` and it just works.
- The port is 50051 because the code says so.
- If the client prints `Greeting: H` instead of `Greeting: Hello Alice`, the
  server code is wrong.

## What actually happened

**The `PORT` environment variable is a trap in containers.** My shell had
`PORT=0` set, which is the convention for "pick any free port". The server
honoured it and bound a random port; the client read the same `PORT=0` and
tried to connect to port 0. Nothing matched, so the client failed with
`EADDRNOTAVAIL` — an error that says nothing about the real problem. Now the
server takes `process.env.PORT` but I always start it with an explicit
`PORT=50051` when I am testing locally.

**gRPC enables `SO_REUSEPORT`, so two servers can share port 50051.** After a
stale server was left running from an earlier attempt, a new server started
"successfully" on the same port and the client got a truncated answer:
`Greeting: H`. The client was talking to the *old* process, which had a
different handler. The fix was not in the code — it was killing the leftover
process. Half-working behaviour here almost always means a stale server, not a
bug in the example.

**`bindAsync` hands back the port it actually bound.** The callback signature
is `(err, port)`, so printing `port` instead of the `PORT` variable is the
honest version, and it is what makes the `PORT=0` case visible in the log
instead of invisible.

**`grpcurl` needs no `.proto` file when reflection is registered.** With
`ReflectionService` added, `grpcurl -plaintext 127.0.0.1:50051 list` printed
`helloworld.Greeter` and `describe` printed the full service definition. The
contract in my hand and the contract on the wire are the same thing — which
is the whole point of the contract-first model.

**Field numbers are the wire format's identity.** `string name = 1` is not
"the first field" in the way a struct member is. The number is what the
client and server agree on. Renumbering it is a breaking change that no
compiler will warn me about.

## The thing I'd have gotten wrong

I assumed a truncated or wrong response meant a bug in my handler code. The
real cause was a second server process silently sharing the port, because
gRPC sets `SO_REUSEPORT` by default. Before debugging gRPC code, check
whether the thing listening on the port is the process I think it is.

## Questions this example answered

- **Where does the contract end and the implementation begin?** At the
  `service Greeter` block. Everything below it is the implementation, and
  `protoc`/`proto-loader` guarantees the two agree on the wire.
- **Why does a unary call look like a function call but travel over HTTP/2?**
  Because the generated stub is a callback around a POST to
  `/helloworld.Greeter/SayHello` with a protobuf body. It looks local and
  behaves remotely — that is the entire trick.
- **What is `keepCase: true` for?** `proto-loader` converts field names to
  `camelCase` by default. Keeping the case means the JavaScript object keys
  match the `.proto` exactly, so there is no mental translation when
  switching between the contract and the code.

## Next

Step 2 - Proto3 basics. The plan is to change one field type at a time and
watch the wire format change with it.
