# Lesson 17: Database Integration and Transactions

In this lesson, you will learn how to integrate persistent data storage with gRPC handlers, handle transactional isolation, and protect against double-spending or overselling using atomic reservation.

---

## 1. Key Principles

1. **Repository Pattern**: Never mix SQL queries directly into gRPC handler callback functions. Wrap queries in dedicated repository classes.
2. **Atomic Inventory Reservation**: Checking inventory and decrementing stock must occur within an atomic database transaction (`SELECT ... FOR UPDATE` in PostgreSQL) to prevent race conditions when concurrent orders arrive simultaneously.
3. **Idempotency Keys**: Use client-provided UUID idempotency keys to ensure retried requests return the original transaction result rather than double-charging.

---

## 2. PostgreSQL Connection Pattern

In production with `pg` (node-postgres):
```javascript
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function reserveStock(productId, quantity) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(
      'SELECT stock FROM products WHERE id = $1 FOR UPDATE',
      [productId]
    );
    if (res.rows[0].stock < quantity) {
      await client.query('ROLLBACK');
      return { success: false, message: 'Out of stock' };
    }
    await client.query(
      'UPDATE products SET stock = stock - $1 WHERE id = $2',
      [quantity, productId]
    );
    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

---

## 3. How to Run

```bash
npm run lesson:17:demo
```
