# Lesson 02: Protocol Buffers (Proto3) Deep Dive

Welcome to Lesson 02. Protocol Buffers (protobuf) is Google's language-neutral, platform-neutral, extensible mechanism for serializing structured data. In this lesson, we explore every proto3 type, understand field tags, explicit presence, schema evolution, and how to prevent wire-level breaking changes.

---

## 1. The Problem Being Solved

JSON and XML are self-describing formats: every single HTTP request transmits field names like `"email_address_of_user": "..."` over the wire repeatedly. Furthermore:
- Numbers in JSON have ambiguous precision (e.g., 64-bit integers often get truncated by JavaScript engines).
- There is no native wire-level distinction between empty strings and absent fields without custom null handling.
- There is no built-in schema compatibility enforcement.

Protocol Buffers solves this:
- **Wire compactness**: Encoded as varints and length-delimited bytes keyed by integer tags (1, 2, 3...) instead of ASCII strings.
- **Strict typing**: Integer widths (int32, int64, uint32, sint32), floats, doubles, booleans, enums, nested objects, and binary bytes.
- **Deterministic Schema Evolution**: Safe forward and backward compatibility across versions.

---

## 2. Core Proto3 Types & Mechanics

### Scalar Types & Varints
| Type | Description | Uses |
|---|---|---|
| `string` | UTF-8 encoded text | Names, identifiers, descriptions |
| `int32` | 32-bit signed integer | Counts, quantities, indices |
| `int64` | 64-bit signed integer | Database IDs, timestamps (represented as string in JS) |
| `sint32` / `sint64` | Signed with ZigZag encoding | Efficient for negative numbers |
| `double` / `float` | IEEE 754 floating point | Decimal coordinates, sensor readings |
| `bool` | Boolean (`true` / `false`) | Feature flags, boolean states |
| `bytes` | Raw binary buffer | Avatars, encryption keys, hashes |

### Complex Structures
- **Enums**: Must always have a zero value named `*_UNSPECIFIED = 0`. In proto3, the zero value is the default on the wire.
- **Nested Messages**: Group related fields (e.g., `Address`).
- **Repeated Fields**: Represent ordered arrays/lists (e.g., `repeated string tags = 12;`).
- **Maps**: Key-value collections (e.g., `map<string, string> metadata = 13;`). Keys must be integral or string types.
- **Oneof**: Mutually exclusive fields. Setting one field automatically clears all others in the group (e.g., `email` vs `phone`).
- **Optional (Explicit Presence)**: In proto3, standard scalar fields default to their zero values (`0`, `""`, `false`) if omitted. Marking a field `optional string nickname = 16;` allows the server to distinguish between "not sent" and "sent as empty string".
- **Well-Known Types**: `google.protobuf.Timestamp`, `google.protobuf.Duration`, `google.protobuf.Any`, etc.

---

## 3. The Number One Golden Rule: Never Reuse Field Tags

In Protocol Buffers, field names exist purely for human readability in code. **On the wire, only the field number (tag) exists.**

If you delete `string old_token = 5;` and later someone adds `int32 retry_count = 5;`, any older client sending messages will corrupt the data on the new server!

To prevent this, use `reserved`:
```protobuf
message TypesShowcase {
  reserved 50, 51, 52 to 55;
  reserved "old_field", "deprecated_field";
}
```
If any developer attempts to add a field with tag 50 or name `old_field`, the protobuf compiler will fail immediately.

---

## 4. How to Run

### Run Server & Client
Terminal 1:
```bash
npm run lesson:02:server
```

Terminal 2:
```bash
npm run lesson:02:client
```

### Run Schema Evolution Demo
```bash
npx tsx lessons/02-protocol-buffers/schema-evolution-demo.ts
```

---

## 5. Expected Output

```
📦 Protobuf Wire Round-Trip Verified:
- name: Alice In Wonderland
- big_id (int64 as string): 9007199254740993
- priority (enum): PRIORITY_HIGH
- address.city: Cloudville
- tags count: 4
- metadata.env: development
- contact (oneof): email="alice@distributed.systems"
- nickname (optional presence): "ProtobufHacker"
```

---

## 6. Common Mistakes

1. **JavaScript Number Precision Truncation (int64)**:
   JavaScript's `Number.MAX_SAFE_INTEGER` is `2^53 - 1` (`9,007,199,254,740,991`). When reading a 64-bit int from a database or protobuf, numbers larger than that will silently lose precision unless proto-loader is configured with `longs: String`.
2. **Missing Enum Zero Value**:
   Proto3 enforces that enum definitions must start at 0. Always name it `UNSPECIFIED` to avoid unintentional default behavior.
3. **Renumbering tags instead of appending**:
   Never renumber fields to make them look tidy or ordered alphabetically. Field numbers are permanent wire contracts.

---

## 7. Exercises

1. **Add an Enum**: Add a `Status` enum to `types_demo.proto` with values `STATUS_UNSPECIFIED = 0`, `STATUS_PENDING = 1`, `STATUS_APPROVED = 2`. Update `TypesShowcase` to include it.
2. **Test Oneof behavior**: Modify `client.ts` to supply both `email` and `phone`. Run the client and observe which one wins.

---

## 8. Interview Questions with Answers

### Q1: How does proto3 handle default values and zero-value wire omission?
**Answer**:
In proto3, if a scalar field has its zero value (empty string `""`, `0`, `false`, empty list), it is omitted from the serialized wire bytes entirely. This saves bandwidth. On the receiving end, missing fields are populated with their zero defaults.

### Q2: What is the difference between `int32` and `sint32`?
**Answer**:
Standard `int32` uses normal two's complement representation. When encoded as a varint, negative numbers (like `-1`) always take 10 bytes on the wire. `sint32` uses ZigZag encoding, which maps negative integers to small positive integers (`-1` becomes `1`, `1` becomes `2`, `-2` becomes `3`), allowing negative numbers close to zero to encode in just 1 or 2 bytes.

### Q3: When should you use `google.protobuf.Any` and what are the trade-offs?
**Answer**:
`Any` contains serialized message bytes along with a type URL identifying the message type. It allows passing dynamic messages without the server needing prior static knowledge of every subtype. The trade-offs are loss of static type safety, additional CPU overhead to unpack the inner message, and potential security risks if deserializing unverified type URLs.
