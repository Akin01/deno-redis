import { assertEquals, assertInstanceOf } from "@std/assert";
import {
  cleanupTestKeys,
  createTestRedis,
  randomTestKey,
} from "./test_helper.ts";

Deno.test("Pipeline - Basic pipelining", async () => {
  const redis = await createTestRedis();

  try {
    const key1 = randomTestKey("pipe1");
    const key2 = randomTestKey("pipe2");
    const key3 = randomTestKey("pipe3");

    // Create pipeline
    const pipeline = redis.pipeline();

    // Queue multiple commands
    pipeline.set(key1, "value1");
    pipeline.set(key2, "value2");
    pipeline.set(key3, "value3");
    pipeline.get(key1);
    pipeline.get(key2);
    pipeline.get(key3);

    // Execute all commands
    const results = await pipeline.flush();

    // Check results
    assertEquals(results.length, 6);

    // SET commands return "OK"
    assertEquals(results[0], "OK");
    assertEquals(results[1], "OK");
    assertEquals(results[2], "OK");

    // GET commands return the values
    assertEquals(results[3], "value1");
    assertEquals(results[4], "value2");
    assertEquals(results[5], "value3");

    // Verify values are actually set
    const directGet = await redis.get(key1);
    assertEquals(directGet, "value1");
  } finally {
    await cleanupTestKeys(redis);
    redis.close();
  }
});

Deno.test("Pipeline - Mixed command types", async () => {
  const redis = await createTestRedis();

  try {
    const stringKey = randomTestKey("string");
    const hashKey = randomTestKey("hash");
    const listKey = randomTestKey("list");
    const setKey = randomTestKey("set");

    const pipeline = redis.pipeline();

    // Mix different command types
    pipeline.set(stringKey, "hello");
    pipeline.hset(hashKey, "field", "value");
    pipeline.lpush(listKey, "item1", "item2");
    pipeline.sadd(setKey, "member1", "member2");

    // Get operations
    pipeline.get(stringKey);
    pipeline.hget(hashKey, "field");
    pipeline.llen(listKey);
    pipeline.scard(setKey);

    const results = await pipeline.flush();

    assertEquals(results.length, 8);

    // Verify the GET results
    assertEquals(results[4], "hello"); // GET string
    assertEquals(results[5], "value"); // HGET hash
    assertEquals(results[6], 2); // LLEN list
    assertEquals(results[7], 2); // SCARD set
  } finally {
    await cleanupTestKeys(redis);
    redis.close();
  }
});

Deno.test("Pipeline - Error handling", async () => {
  const redis = await createTestRedis();

  try {
    const validKey = randomTestKey("valid");

    const pipeline = redis.pipeline();

    // Mix valid and invalid commands
    pipeline.set(validKey, "value");
    pipeline.get(validKey);
    // This should cause an error - wrong number of arguments
    pipeline.sendCommand("SET", "incomplete");
    pipeline.get(validKey);

    const results = await pipeline.flush();

    assertEquals(results.length, 4);

    // First command should succeed
    assertEquals(results[0], "OK");
    assertEquals(results[1], "value");

    // Third command should be an error
    assertInstanceOf(results[2], Error);

    // Fourth command should still work
    assertEquals(results[3], "value");
  } finally {
    await cleanupTestKeys(redis);
    redis.close();
  }
});

Deno.test("Pipeline - Multiple flushes", async () => {
  const redis = await createTestRedis();

  try {
    const key1 = randomTestKey("flush1");
    const key2 = randomTestKey("flush2");

    const pipeline = redis.pipeline();

    // First batch
    pipeline.set(key1, "value1");
    pipeline.get(key1);

    const results1 = await pipeline.flush();
    assertEquals(results1.length, 2);
    assertEquals(results1[0], "OK");
    assertEquals(results1[1], "value1");

    // Second batch - pipeline should be reusable
    pipeline.set(key2, "value2");
    pipeline.get(key2);

    const results2 = await pipeline.flush();
    assertEquals(results2.length, 2);
    assertEquals(results2[0], "OK");
    assertEquals(results2[1], "value2");
  } finally {
    await cleanupTestKeys(redis);
    redis.close();
  }
});

Deno.test("Pipeline - Empty pipeline", async () => {
  const redis = await createTestRedis();

  try {
    const pipeline = redis.pipeline();

    // Flush empty pipeline
    const results = await pipeline.flush();
    assertEquals(results.length, 0);
  } finally {
    redis.close();
  }
});

Deno.test("Pipeline - Performance comparison", async () => {
  const redis = await createTestRedis();

  try {
    const keyPrefix = randomTestKey("perf");
    const commandCount = 100;

    // Sequential execution
    const sequentialStart = performance.now();
    for (let i = 0; i < commandCount; i++) {
      await redis.set(`${keyPrefix}:seq:${i}`, `value${i}`);
    }
    const sequentialTime = performance.now() - sequentialStart;

    // Pipeline execution
    const pipelineStart = performance.now();
    const pipeline = redis.pipeline();
    for (let i = 0; i < commandCount; i++) {
      pipeline.set(`${keyPrefix}:pipe:${i}`, `value${i}`);
    }
    await pipeline.flush();
    const pipelineTime = performance.now() - pipelineStart;

    console.log(`Sequential: ${sequentialTime.toFixed(2)}ms`);
    console.log(`Pipeline: ${pipelineTime.toFixed(2)}ms`);
    console.log(`Speedup: ${(sequentialTime / pipelineTime).toFixed(2)}x`);

    // Pipeline should be significantly faster
    // Note: This is just for demonstration, actual speedup depends on network latency
    assertEquals(pipelineTime < sequentialTime, true);
  } finally {
    await cleanupTestKeys(redis);
    redis.close();
  }
});
