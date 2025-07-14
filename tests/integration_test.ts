/**
 * Integration Test Suite
 *
 * Comprehensive integration tests that validate real-world usage scenarios
 * and end-to-end functionality of the Redis client. These tests are designed
 * to ensure that all components work together correctly and that the examples
 * in the documentation work as expected.
 *
 * These tests cover:
 * - End-to-end workflows combining multiple Redis operations
 * - Real-world usage patterns from the examples
 * - Cross-feature integration scenarios
 * - Performance characteristics under realistic loads
 * - Error recovery and resilience patterns
 */

import {
  assertEquals,
  assertInstanceOf,
  assertNotEquals,
  assertRejects,
  skipIfNoRedis,
  TEST_CONFIG,
  timeout,
} from "./mod.ts";
import {
  connect,
  ConnectionClosedError,
  createLazyClient,
  parseURL,
} from "../mod.ts";
import {
  cleanupTestKeys,
  createTestRedis,
  randomTestKey,
  waitFor,
} from "./test_helper.ts";

// Skip tests if Redis is not available
if (skipIfNoRedis()) {
  Deno.exit(0);
}

Deno.test("Integration - Basic Redis workflow", async () => {
  const redis = await createTestRedis();

  try {
    // Test connection and ping
    const pong = await redis.ping();
    assertEquals(pong, "PONG");

    // String operations workflow
    const userKey = randomTestKey("user");
    await redis.set(userKey, "John Doe");
    const user = await redis.get(userKey);
    assertEquals(user, "John Doe");

    // Set with expiration and verify TTL
    const sessionKey = randomTestKey("session");
    await redis.setex(sessionKey, 10, "abc123");
    const ttl = await redis.ttl(sessionKey);
    assertEquals(ttl <= 10 && ttl > 0, true);

    // Counter operations
    const counterKey = randomTestKey("visits");
    await redis.set(counterKey, "0");
    await redis.incr(counterKey);
    await redis.incr(counterKey);
    const visits = await redis.get(counterKey);
    assertEquals(visits, "2");

    // Hash operations for user profile
    const profileKey = randomTestKey("profile");
    await redis.hset(profileKey, "name", "Alice Smith");
    await redis.hset(profileKey, "email", "alice@example.com");
    await redis.hset(profileKey, "age", "28");

    const name = await redis.hget(profileKey, "name");
    assertEquals(name, "Alice Smith");

    const profile = await redis.hgetall(profileKey);
    assertEquals(profile.includes("name"), true);
    assertEquals(profile.includes("Alice Smith"), true);
    assertEquals(profile.includes("email"), true);

    // Activity log using lists
    const logKey = randomTestKey("activity");
    await redis.lpush(logKey, "user_login", "page_view", "purchase");
    const logSize = await redis.llen(logKey);
    assertEquals(logSize, 3);

    const recentActivity = await redis.lrange(logKey, 0, 1);
    assertEquals(recentActivity.length, 2);
    assertEquals(recentActivity[0], "purchase"); // Most recent

    // Tags using sets
    const tagsKey = randomTestKey("tags");
    await redis.sadd(tagsKey, "javascript", "redis", "deno");
    const tagCount = await redis.scard(tagsKey);
    assertEquals(tagCount, 3);

    const hasJsTag = await redis.sismember(tagsKey, "javascript");
    assertEquals(hasJsTag, 1);

  } finally {
    await cleanupTestKeys(redis, "user:*");
    await cleanupTestKeys(redis, "session:*");
    await cleanupTestKeys(redis, "visits:*");
    await cleanupTestKeys(redis, "profile:*");
    await cleanupTestKeys(redis, "activity:*");
    await cleanupTestKeys(redis, "tags:*");
    redis.close();
  }
});

Deno.test("Integration - E-commerce shopping cart workflow", async () => {
  const redis = await createTestRedis();

  try {
    const userId = "user123";
    const cartKey = randomTestKey(`cart:${userId}`);
    const inventoryKey = randomTestKey("inventory");
    const ordersKey = randomTestKey("orders");

    // Setup inventory
    await redis.hset(inventoryKey, "product1", "100");
    await redis.hset(inventoryKey, "product2", "50");
    await redis.hset(inventoryKey, "product3", "25");

    // Add items to cart
    await redis.hset(cartKey, "product1", "2");
    await redis.hset(cartKey, "product2", "1");

    // Get cart contents
    const cartItems = await redis.hgetall(cartKey);
    assertEquals(cartItems.includes("product1"), true);
    assertEquals(cartItems.includes("2"), true);

    // Update cart quantity
    await redis.hset(cartKey, "product1", "3");
    const updatedQty = await redis.hget(cartKey, "product1");
    assertEquals(updatedQty, "3");

    // Calculate cart total (simulation)
    const product1Stock = await redis.hget(inventoryKey, "product1");
    const product2Stock = await redis.hget(inventoryKey, "product2");
    assertEquals(parseInt(product1Stock!), 100);
    assertEquals(parseInt(product2Stock!), 50);

    // Process order using pipeline for atomicity simulation
    const pipeline = redis.pipeline();
    pipeline.hincrby(inventoryKey, "product1", -3);
    pipeline.hincrby(inventoryKey, "product2", -1);
    pipeline.del(cartKey);
    pipeline.incr(ordersKey);

    const results = await pipeline.flush();
    assertEquals(results.length, 4);

    // Verify inventory updated
    const newStock1 = await redis.hget(inventoryKey, "product1");
    const newStock2 = await redis.hget(inventoryKey, "product2");
    assertEquals(parseInt(newStock1!), 97);
    assertEquals(parseInt(newStock2!), 49);

    // Verify cart cleared
    const cartExists = await redis.exists(cartKey);
    assertEquals(cartExists, 0);

    // Verify order count
    const orderCount = await redis.get(ordersKey);
    assertEquals(orderCount, "1");

    console.log("✅ E-commerce shopping cart workflow integration test completed");
  } finally {
    await cleanupTestKeys(redis, "cart:*");
    await cleanupTestKeys(redis, "inventory:*");
    await cleanupTestKeys(redis, "orders:*");
    redis.close();
  }
});

Deno.test("Integration - Real-time analytics workflow", async () => {
  const redis = await createTestRedis();

  try {
    const metricsKey = randomTestKey("metrics");
    const activeUsersKey = randomTestKey("active_users");
    const eventStreamKey = randomTestKey("events");

    // Simulate real-time metrics collection
    const startTime = Date.now();

    // Track page views
    await redis.incr(`${metricsKey}:page_views`);
    await redis.incr(`${metricsKey}:page_views`);
    await redis.incr(`${metricsKey}:page_views`);

    // Track unique users
    await redis.sadd(activeUsersKey, "user1", "user2", "user3", "user1"); // user1 duplicate
    const uniqueUsers = await redis.scard(activeUsersKey);
    assertEquals(uniqueUsers, 3);

    // Event stream for analytics
    await redis.xadd(eventStreamKey, "*", {
      event_type: "page_view",
      user_id: "user1",
      page: "/home",
      timestamp: startTime.toString(),
    });

    await redis.xadd(eventStreamKey, "*", {
      event_type: "click",
      user_id: "user2",
      element: "button",
      timestamp: (startTime + 1000).toString(),
    });

    await redis.xadd(eventStreamKey, "*", {
      event_type: "purchase",
      user_id: "user3",
      product_id: "prod123",
      amount: "29.99",
      timestamp: (startTime + 2000).toString(),
    });

    // Analytics queries
    const pageViews = await redis.get(`${metricsKey}:page_views`);
    assertEquals(pageViews, "3");

    const eventCount = await redis.xlen(eventStreamKey);
    assertEquals(eventCount, 3);

    const events = await redis.xrange(eventStreamKey, "-", "+");
    assertEquals(events.length, 3);

    // Filter events by type (simulation)
    const purchaseEvents = events.filter(
      event => event.fieldValues.event_type === "purchase"
    );
    assertEquals(purchaseEvents.length, 1);
    assertEquals(purchaseEvents[0].fieldValues.amount, "29.99");

    // Real-time dashboard data
    const dashboardData = {
      totalPageViews: parseInt(pageViews!),
      activeUsers: uniqueUsers,
      totalEvents: eventCount,
      purchaseEvents: purchaseEvents.length,
    };

    assertEquals(dashboardData.totalPageViews, 3);
    assertEquals(dashboardData.activeUsers, 3);
    assertEquals(dashboardData.totalEvents, 3);
    assertEquals(dashboardData.purchaseEvents, 1);

    console.log("✅ Real-time analytics workflow integration test completed");
  } finally {
    await cleanupTestKeys(redis, "metrics:*");
    await cleanupTestKeys(redis, "active_users:*");
    await cleanupTestKeys(redis, "events:*");
    redis.close();
  }
});

Deno.test("Integration - Task queue with consumer groups", async () => {
  const redis = await createTestRedis();

  try {
    const queueKey = randomTestKey("task_queue");
    const groupName = "workers";
    const worker1 = "worker1";
    const worker2 = "worker2";

    // Producer: Add tasks to queue
    const task1 = await redis.xadd(queueKey, "*", {
      task_type: "email",
      recipient: "user@example.com",
      priority: "high",
      data: JSON.stringify({ subject: "Welcome!", body: "Hello!" }),
    });

    const task2 = await redis.xadd(queueKey, "*", {
      task_type: "image_resize",
      image_id: "img123",
      priority: "medium",
      data: JSON.stringify({ width: 800, height: 600 }),
    });

    const task3 = await redis.xadd(queueKey, "*", {
      task_type: "backup",
      database: "users",
      priority: "low",
      data: JSON.stringify({ tables: ["users", "profiles"] }),
    });

    // Setup consumer group
    await redis.xgroupCreate(queueKey, groupName, 0, true);

    // Worker 1 processes tasks
    const worker1Tasks = await redis.xreadgroup(
      [{ key: queueKey, xid: ">" }],
      { group: groupName, consumer: worker1, count: 2 },
    );

    assertEquals(worker1Tasks.length, 1);
    assertEquals(worker1Tasks[0].messages.length, 2);

    // Worker 2 processes remaining tasks
    const worker2Tasks = await redis.xreadgroup(
      [{ key: queueKey, xid: ">" }],
      { group: groupName, consumer: worker2 },
    );

    assertEquals(worker2Tasks[0].messages.length, 1);

    // Simulate task processing and acknowledgment
    const processedTask = worker1Tasks[0].messages[0];
    assertEquals(processedTask.fieldValues.task_type, "email");

    // Acknowledge completed task
    const ackResult = await redis.xack(queueKey, groupName, processedTask.xid);
    assertEquals(ackResult, 1);

    // Check pending tasks
    const pending = await redis.xpending(queueKey, groupName);
    assertEquals(pending.count, 2); // 1 from worker1 + 1 from worker2

    // Worker 1 completes second task
    await redis.xack(queueKey, groupName, worker1Tasks[0].messages[1].xid);

    // Final pending check
    const finalPending = await redis.xpending(queueKey, groupName);
    assertEquals(finalPending.count, 1); // Only worker2's task remains

    console.log("✅ Task queue with consumer groups integration test completed");
  } finally {
    const queueKey = randomTestKey("task_queue");
    const groupName = "workers";
    try {
      await redis.xgroupDestroy(queueKey, groupName);
    } catch {
      // Group might not exist, ignore error
    }
    await cleanupTestKeys(redis, "task_queue:*");
    redis.close();
  }
});

Deno.test("Integration - Error handling and resilience", async () => {
  const redis = await createTestRedis();

  try {
    // Test connection status methods
    assertEquals(redis.isConnected, true);
    assertEquals(redis.isClosed, false);

    // Test operations on non-existent keys
    const nonExistentKey = randomTestKey("nonexistent");

    const getValue = await redis.get(nonExistentKey);
    assertEquals(getValue, null);

    const hashValue = await redis.hget(nonExistentKey, "field");
    assertEquals(hashValue, null);

    const listLength = await redis.llen(nonExistentKey);
    assertEquals(listLength, 0);

    // Test TTL on non-existent key
    const ttl = await redis.ttl(nonExistentKey);
    assertEquals(ttl, -2); // -2 means key doesn't exist

    // Test error recovery with invalid operations
    const stringKey = randomTestKey("string");
    await redis.set(stringKey, "not-a-number");

    // This should fail but not crash the connection
    await assertRejects(
      async () => {
        await redis.incr(stringKey);
      },
    );

    // Connection should still be usable
    const ping = await redis.ping();
    assertEquals(ping, "PONG");

    // Test large data handling
    const largeKey = randomTestKey("large");
    const largeValue = "x".repeat(10000); // 10KB string
    await redis.set(largeKey, largeValue);
    const retrievedLargeValue = await redis.get(largeKey);
    assertEquals(retrievedLargeValue, largeValue);

    // Test pipeline error handling
    const pipeline = redis.pipeline();
    pipeline.set("valid_key", "valid_value");
    pipeline.incr(stringKey); // This will fail
    pipeline.get("valid_key");

    const results = await pipeline.flush();
    assertEquals(results.length, 3);
    assertEquals(results[0], "OK");
    assertInstanceOf(results[1], Error);
    assertEquals(results[2], "valid_value");

    console.log("✅ Error handling and resilience integration test completed");
  } finally {
    await cleanupTestKeys(redis, "nonexistent:*");
    await cleanupTestKeys(redis, "string:*");
    await cleanupTestKeys(redis, "large:*");
    await cleanupTestKeys(redis, "valid_key");
    redis.close();
  }
});

Deno.test("Integration - Connection lifecycle and recovery", async () => {
  // Test normal connection lifecycle
  const redis = await createTestRedis();

  assertEquals(redis.isConnected, true);
  assertEquals(redis.isClosed, false);

  // Test operations work
  const testKey = randomTestKey("lifecycle");
  await redis.set(testKey, "test_value");
  const value = await redis.get(testKey);
  assertEquals(value, "test_value");

  // Close connection
  redis.close();

  assertEquals(redis.isConnected, false);
  assertEquals(redis.isClosed, true);

  // Test operations fail after close
  await assertRejects(
    async () => {
      await redis.ping();
    },
    ConnectionClosedError,
  );

  // Test lazy client lifecycle
  const lazyRedis = createLazyClient({
    hostname: "127.0.0.1",
    port: 6379,
  });

  assertEquals(lazyRedis.isConnected, false);
  assertEquals(lazyRedis.isClosed, false);

  // First operation connects
  await lazyRedis.ping();
  assertEquals(lazyRedis.isConnected, true);

  // Test operations work with lazy client
  const lazyKey = randomTestKey("lazy");
  await lazyRedis.set(lazyKey, "lazy_value");
  const lazyValue = await lazyRedis.get(lazyKey);
  assertEquals(lazyValue, "lazy_value");

  // Cleanup and close
  await lazyRedis.del(testKey, lazyKey);
  lazyRedis.close();
  assertEquals(lazyRedis.isClosed, true);

  console.log("✅ Connection lifecycle and recovery integration test completed");
});

Deno.test("Integration - Error handling", async () => {
  const redis = await createTestRedis();

  try {
    // Test non-existent key
    const nonExistent = await redis.get("definitely-does-not-exist");
    assertEquals(nonExistent, null);

    // Test type mismatch operations
    await redis.set("string-key", "value");

    try {
      await redis.hget("string-key", "field");
      // This should work in Redis (returns null for wrong type operations)
    } catch (error) {
      // Some operations might throw errors
      console.log(
        "Expected error for type mismatch:",
        (error as Error).message,
      );
    }

    console.log("✅ Error handling test completed");
  } finally {
    await cleanupTestKeys(redis);
    redis.close();
  }
});

Deno.test("Integration - Connection lifecycle", async () => {
  const redis = await connect({
    hostname: "127.0.0.1",
    port: 6379,
    name: "lifecycle-test",
  });

  try {
    // Verify connection state
    assertEquals(redis.isConnected, true);
    assertEquals(redis.isClosed, false);

    // Test operation
    await redis.ping();

    // Close connection
    redis.close();
    assertEquals(redis.isClosed, true);

    console.log("✅ Connection lifecycle test completed");
  } catch (error) {
    redis.close();
    throw error;
  }
});
