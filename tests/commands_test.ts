import {
  assertArrayIncludes,
  assertEquals,
  assertNotEquals,
} from "@std/assert";
import {
  cleanupTestKeys,
  createTestRedis,
  randomTestKey,
} from "./test_helper.ts";

Deno.test("Commands - String operations", async () => {
  const redis = await createTestRedis();
  const key = randomTestKey("string");

  try {
    // Basic SET/GET
    await redis.set(key, "hello world");
    const value = await redis.get(key);
    assertEquals(value, "hello world");

    // SET with expiration
    const exKey = randomTestKey("expire");
    await redis.setex(exKey, 1, "expires");
    const exValue = await redis.get(exKey);
    assertEquals(exValue, "expires");

    // TTL check
    const ttl = await redis.ttl(exKey);
    assertEquals(ttl <= 1 && ttl > 0, true);

    // INCR/DECR
    const counterKey = randomTestKey("counter");
    await redis.set(counterKey, "10");
    const incr = await redis.incr(counterKey);
    assertEquals(incr, 11);

    const decr = await redis.decr(counterKey);
    assertEquals(decr, 10);

    // APPEND
    await redis.set(key, "hello");
    const length = await redis.append(key, " world");
    assertEquals(length, 11);
    const appendedValue = await redis.get(key);
    assertEquals(appendedValue, "hello world");

    // STRLEN
    const strLen = await redis.strlen(key);
    assertEquals(strLen, 11);
  } finally {
    await cleanupTestKeys(redis);
    redis.close();
  }
});

Deno.test("Commands - Hash operations", async () => {
  const redis = await createTestRedis();
  const key = randomTestKey("hash");

  try {
    // HSET/HGET
    await redis.hset(key, "field1", "value1");
    const value = await redis.hget(key, "field1");
    assertEquals(value, "value1");

    // HMSET/HMGET
    await redis.hmset(key, { field2: "value2", field3: "value3" });
    const values = await redis.hmget(key, "field1", "field2", "field3");
    assertEquals(values, ["value1", "value2", "value3"]);

    // HGETALL
    const all = await redis.hgetall(key);
    assertEquals(all, [
      "field1",
      "value1",
      "field2",
      "value2",
      "field3",
      "value3",
    ]);

    // HKEYS/HVALS
    const keys = await redis.hkeys(key);
    assertArrayIncludes(keys, ["field1", "field2", "field3"]);

    const vals = await redis.hvals(key);
    assertArrayIncludes(vals, ["value1", "value2", "value3"]);

    // HLEN
    const length = await redis.hlen(key);
    assertEquals(length, 3);

    // HEXISTS
    const exists = await redis.hexists(key, "field1");
    assertEquals(exists, 1);

    const notExists = await redis.hexists(key, "nonexistent");
    assertEquals(notExists, 0);

    // HDEL
    const deleted = await redis.hdel(key, "field1");
    assertEquals(deleted, 1);

    const afterDel = await redis.hlen(key);
    assertEquals(afterDel, 2);
  } finally {
    await cleanupTestKeys(redis);
    redis.close();
  }
});

Deno.test("Commands - List operations", async () => {
  const redis = await createTestRedis();
  const key = randomTestKey("list");

  try {
    // LPUSH/RPUSH
    await redis.lpush(key, "first");
    await redis.rpush(key, "last");
    await redis.lpush(key, "new-first");

    // LLEN
    const length = await redis.llen(key);
    assertEquals(length, 3);

    // LRANGE
    const all = await redis.lrange(key, 0, -1);
    assertEquals(all, ["new-first", "first", "last"]);

    // LINDEX
    const firstItem = await redis.lindex(key, 0);
    assertEquals(firstItem, "new-first");

    // LPOP/RPOP
    const leftPop = await redis.lpop(key);
    assertEquals(leftPop, "new-first");

    const rightPop = await redis.rpop(key);
    assertEquals(rightPop, "last");

    const remaining = await redis.lrange(key, 0, -1);
    assertEquals(remaining, ["first"]);
  } finally {
    await cleanupTestKeys(redis);
    redis.close();
  }
});

Deno.test("Commands - Set operations", async () => {
  const redis = await createTestRedis();
  const key = randomTestKey("set");

  try {
    // SADD
    const added = await redis.sadd(key, "member1", "member2", "member3");
    assertEquals(added, 3);

    // SCARD
    const cardinality = await redis.scard(key);
    assertEquals(cardinality, 3);

    // SMEMBERS
    const members = await redis.smembers(key);
    assertEquals(members.length, 3);
    assertArrayIncludes(members, ["member1", "member2", "member3"]);

    // SISMEMBER
    const isMember = await redis.sismember(key, "member1");
    assertEquals(isMember, 1);

    const notMember = await redis.sismember(key, "nonexistent");
    assertEquals(notMember, 0);

    // SREM
    const removed = await redis.srem(key, "member2");
    assertEquals(removed, 1);

    const afterRemove = await redis.scard(key);
    assertEquals(afterRemove, 2);

    // SPOP
    const popped = await redis.spop(key);
    assertNotEquals(popped, null);

    const afterPop = await redis.scard(key);
    assertEquals(afterPop, 1);
  } finally {
    await cleanupTestKeys(redis);
    redis.close();
  }
});

Deno.test("Commands - Key operations", async () => {
  const redis = await createTestRedis();
  const key1 = randomTestKey("test");
  const key2 = randomTestKey("test");

  try {
    // SET keys
    await redis.set(key1, "value1");
    await redis.set(key2, "value2");

    // EXISTS
    const exists = await redis.exists(key1, key2);
    assertEquals(exists, 2);

    const notExists = await redis.exists("nonexistent-key");
    assertEquals(notExists, 0);

    // KEYS pattern
    const keys = await redis.keys("test:*");
    assertEquals(keys.length >= 2, true);

    // TYPE
    const type = await redis.type(key1);
    assertEquals(type, "string");

    // EXPIRE/TTL
    await redis.expire(key1, 60);
    const ttl = await redis.ttl(key1);
    assertEquals(ttl > 0 && ttl <= 60, true);

    // PERSIST
    await redis.persist(key1);
    const persistedTtl = await redis.ttl(key1);
    assertEquals(persistedTtl, -1);

    // RENAME
    const newKey = randomTestKey("renamed");
    await redis.rename(key1, newKey);

    const oldExists = await redis.exists(key1);
    assertEquals(oldExists, 0);

    const newExists = await redis.exists(newKey);
    assertEquals(newExists, 1);

    // DEL
    const deleted = await redis.del(newKey, key2);
    assertEquals(deleted, 2);
  } finally {
    await cleanupTestKeys(redis);
    redis.close();
  }
});
