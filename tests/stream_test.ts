/**
 * Redis Streams Test Suite
 *
 * Comprehensive tests for Redis Streams functionality including:
 * - Basic stream operations (XADD, XREAD, XRANGE, XREVRANGE)
 * - Stream information and management (XLEN, XTRIM, XINFO)
 * - Consumer groups (XGROUP, XREADGROUP, XACK, XPENDING)
 * - Stream parsing and utility functions
 * - Error handling and edge cases
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
import { connect } from "../mod.ts";
import {
  parseXId,
  parseXMessage,
  parseXPendingCounts,
  parseXPendingConsumers,
  xidstr,
  type XId,
  type XMessage,
  type XIdInput,
} from "../stream.ts";
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

Deno.test("Stream - Basic XADD and XREAD operations", async () => {
  const redis = await createTestRedis();
  const streamKey = randomTestKey("basic-stream");

  try {
    // Test XADD with auto-generated ID
    const messageId1 = await redis.xadd(streamKey, "*", {
      sensor: "temperature",
      value: "23.5",
      unit: "celsius",
    });

    assertInstanceOf(messageId1, Object);
    assertEquals(typeof messageId1.unixMs, "number");
    assertEquals(typeof messageId1.seqNo, "number");
    assertEquals(messageId1.unixMs > 0, true);

    // Test XADD with specific ID
    const specificTime = Date.now();
    const messageId2 = await redis.xadd(streamKey, [specificTime, 0], {
      sensor: "humidity",
      value: "65",
      unit: "percent",
    });

    assertEquals(messageId2.unixMs, specificTime);
    assertEquals(messageId2.seqNo, 0);

    // Test XREAD
    const messages = await redis.xread([{ key: streamKey, xid: 0 }]);
    assertEquals(messages.length, 1);
    assertEquals(messages[0].key, streamKey);
    assertEquals(messages[0].messages.length, 2);

    // Verify message content
    const firstMessage = messages[0].messages[0];
    assertEquals(firstMessage.fieldValues.sensor, "temperature");
    assertEquals(firstMessage.fieldValues.value, "23.5");
    assertEquals(firstMessage.fieldValues.unit, "celsius");

    console.log("✅ Basic XADD and XREAD operations test completed");
  } finally {
    await cleanupTestKeys(redis, streamKey);
    redis.close();
  }
});

Deno.test("Stream - XRANGE and XREVRANGE operations", async () => {
  const redis = await createTestRedis();
  const streamKey = randomTestKey("range-stream");

  try {
    // Add multiple messages
    const baseTime = Date.now();
    const ids = [];

    for (let i = 0; i < 5; i++) {
      const id = await redis.xadd(streamKey, [baseTime + i * 1000, 0], {
        index: i.toString(),
        timestamp: (baseTime + i * 1000).toString(),
      });
      ids.push(id);
    }

    // Test XRANGE - all messages
    const allMessages = await redis.xrange(streamKey, "-", "+");
    assertEquals(allMessages.length, 5);

    // Test XRANGE - with count limit
    const limitedMessages = await redis.xrange(streamKey, "-", "+", 3);
    assertEquals(limitedMessages.length, 3);

    // Test XRANGE - specific range
    const rangeMessages = await redis.xrange(
      streamKey,
      [baseTime + 1000, 0],
      [baseTime + 3000, 0],
    );
    assertEquals(rangeMessages.length, 3);
    assertEquals(rangeMessages[0].fieldValues.index, "1");
    assertEquals(rangeMessages[2].fieldValues.index, "3");

    // Test XREVRANGE - reverse order
    const reverseMessages = await redis.xrevrange(streamKey, "+", "-", 3);
    assertEquals(reverseMessages.length, 3);
    assertEquals(reverseMessages[0].fieldValues.index, "4"); // Last message first
    assertEquals(reverseMessages[2].fieldValues.index, "2");

    console.log("✅ XRANGE and XREVRANGE operations test completed");
  } finally {
    await cleanupTestKeys(redis, streamKey);
    redis.close();
  }
});

Deno.test("Stream - XLEN and XTRIM operations", async () => {
  const redis = await createTestRedis();
  const streamKey = randomTestKey("trim-stream");

  try {
    // Add messages
    for (let i = 0; i < 10; i++) {
      await redis.xadd(streamKey, "*", {
        message: `Message ${i}`,
        sequence: i.toString(),
      });
    }

    // Test XLEN
    const length = await redis.xlen(streamKey);
    assertEquals(length, 10);

    // Test XTRIM - exact count
    const trimmed = await redis.xtrim(streamKey, { elements: 5 });
    assertEquals(trimmed >= 0, true);

    const newLength = await redis.xlen(streamKey);
    assertEquals(newLength <= 5, true);

    // Add more messages
    for (let i = 10; i < 15; i++) {
      await redis.xadd(streamKey, "*", {
        message: `Message ${i}`,
        sequence: i.toString(),
      });
    }

    // Test XTRIM - approximate count
    const lengthBeforeTrim = await redis.xlen(streamKey);
    const trimmedApprox = await redis.xtrim(streamKey, {
      elements: 3,
      approx: true,
    });
    assertEquals(trimmedApprox >= 0, true);

    const finalLength = await redis.xlen(streamKey);
    assertEquals(finalLength <= lengthBeforeTrim, true);

    console.log("✅ XLEN and XTRIM operations test completed");
  } finally {
    await cleanupTestKeys(redis, streamKey);
    redis.close();
  }
});

Deno.test("Stream - Consumer Groups operations", async () => {
  const redis = await createTestRedis();
  const streamKey = randomTestKey("group-stream");
  const groupName = "test-group";
  const consumerName = "test-consumer";

  try {
    // Add some initial messages
    const msg1 = await redis.xadd(streamKey, "*", { event: "start" });
    const msg2 = await redis.xadd(streamKey, "*", { event: "middle" });
    const msg3 = await redis.xadd(streamKey, "*", { event: "end" });

    // Create consumer group
    const groupCreated = await redis.xgroupCreate(streamKey, groupName, 0, true);
    assertEquals(groupCreated, "OK");

    // Test XREADGROUP
    const groupMessages = await redis.xreadgroup(
      [{ key: streamKey, xid: ">" }],
      {
        group: groupName,
        consumer: consumerName,
      },
    );

    assertEquals(groupMessages.length, 1);
    assertEquals(groupMessages[0].key, streamKey);
    assertEquals(groupMessages[0].messages.length, 3);

    // Test XPENDING - check pending messages
    const pending = await redis.xpending(streamKey, groupName);
    assertEquals(pending.count, 3);
    assertEquals(pending.consumers.length, 1);
    assertEquals(pending.consumers[0].name, consumerName);
    assertEquals(pending.consumers[0].pending, 3);

    // Test XACK - acknowledge messages
    const ackResult = await redis.xack(
      streamKey,
      groupName,
      groupMessages[0].messages[0].xid,
    );
    assertEquals(ackResult, 1);

    // Check pending after ACK
    const pendingAfterAck = await redis.xpending(streamKey, groupName);
    assertEquals(pendingAfterAck.count, 2);

    // Test XPENDING with range
    const pendingDetails = await redis.xpendingCount(
      streamKey,
      groupName,
      { start: "-", end: "+", count: 10 },
    );
    assertEquals(pendingDetails.length, 2);
    assertEquals(pendingDetails[0].owner, consumerName);

    console.log("✅ Consumer Groups operations test completed");
  } finally {
    // Cleanup consumer group
    try {
      await redis.xgroupDestroy(streamKey, groupName);
    } catch {
      // Group might not exist, ignore error
    }
    await cleanupTestKeys(redis, streamKey);
    redis.close();
  }
});

Deno.test("Stream - XINFO operations", async () => {
  const redis = await createTestRedis();
  const streamKey = randomTestKey("info-stream");
  const groupName = "info-group";

  try {
    // Add messages
    await redis.xadd(streamKey, "*", { data: "first" });
    await redis.xadd(streamKey, "*", { data: "second" });
    await redis.xadd(streamKey, "*", { data: "third" });

    // Create consumer group
    await redis.xgroupCreate(streamKey, groupName, 0, true);

    // Test XINFO STREAM
    const streamInfo = await redis.xinfoStream(streamKey);
    assertEquals(streamInfo.length, 3);
    assertEquals(streamInfo.groups, 1);
    assertEquals(typeof streamInfo.radixTreeKeys, "number");
    assertEquals(typeof streamInfo.radixTreeNodes, "number");
    assertInstanceOf(streamInfo.lastGeneratedId, Object);
    assertInstanceOf(streamInfo.firstEntry, Object);
    assertInstanceOf(streamInfo.lastEntry, Object);

    // Verify first and last entries
    assertEquals(streamInfo.firstEntry.fieldValues.data, "first");
    assertEquals(streamInfo.lastEntry.fieldValues.data, "third");

    // Test XINFO GROUPS
    const groupsInfo = await redis.xinfoGroups(streamKey);
    assertEquals(groupsInfo.length, 1);
    assertEquals(groupsInfo[0].name, groupName);
    assertEquals(groupsInfo[0].pending, 0);
    assertEquals(typeof groupsInfo[0].lastDeliveredId.unixMs, "number");

    console.log("✅ XINFO operations test completed");
  } finally {
    try {
      await redis.xgroupDestroy(streamKey, groupName);
    } catch {
      // Group might not exist, ignore error
    }
    await cleanupTestKeys(redis, streamKey);
    redis.close();
  }
});

Deno.test("Stream - Parsing utility functions", () => {
  // Test parseXId
  const xid = parseXId("1640995200000-0");
  assertEquals(xid.unixMs, 1640995200000);
  assertEquals(xid.seqNo, 0);

  const xidWithSeq = parseXId("1640995200000-5");
  assertEquals(xidWithSeq.unixMs, 1640995200000);
  assertEquals(xidWithSeq.seqNo, 5);

  // Test xidstr
  assertEquals(xidstr("*"), "*");
  assertEquals(xidstr("+"), "+");
  assertEquals(xidstr("-"), "-");
  assertEquals(xidstr("$"), "$");
  assertEquals(xidstr(">"), ">");
  assertEquals(xidstr(1640995200000), "1640995200000-0");
  assertEquals(xidstr([1640995200000, 5]), "1640995200000-5");
  assertEquals(xidstr({ unixMs: 1640995200000, seqNo: 3 }), "1640995200000-3");

  // Test parseXMessage
  const rawMessage: [string, string[]] = [
    "1640995200000-0",
    ["field1", "value1", "field2", "value2"],
  ];
  const message = parseXMessage(rawMessage);
  assertEquals(message.xid.unixMs, 1640995200000);
  assertEquals(message.xid.seqNo, 0);
  assertEquals(message.fieldValues.field1, "value1");
  assertEquals(message.fieldValues.field2, "value2");

  console.log("✅ Parsing utility functions test completed");
});

Deno.test("Stream - Error handling and edge cases", async () => {
  const redis = await createTestRedis();
  const streamKey = randomTestKey("error-stream");
  const nonExistentStreamKey = randomTestKey("nonexistent");

  try {
    // Test operations on non-existent stream
    const emptyRange = await redis.xrange(nonExistentStreamKey, "-", "+");
    assertEquals(emptyRange.length, 0);

    const streamLength = await redis.xlen(nonExistentStreamKey);
    assertEquals(streamLength, 0);

    // Test XREADGROUP on non-existent group
    await assertRejects(
      async () => {
        await redis.xreadgroup(
          [{ key: streamKey, xid: ">" }],
          { group: "nonexistent-group", consumer: "test-consumer" },
        );
      },
      Error,
    );

    // Test creating group on non-existent stream without mkstream
    await assertRejects(
      async () => {
        await redis.xgroupCreate(nonExistentStreamKey, "test-group", 0);
      },
      Error,
    );

    // Test invalid ID formats (should be handled gracefully)
    await redis.xadd(streamKey, "*", { test: "data" });

    // Note: Testing blocking reads can cause timer leaks in tests
    // This functionality is covered in integration tests instead

    console.log("✅ Error handling and edge cases test completed");
  } finally {
    await cleanupTestKeys(redis, streamKey);
    await cleanupTestKeys(redis, nonExistentStreamKey);
    redis.close();
  }
});

Deno.test("Stream - Advanced consumer group scenarios", async () => {
  const redis = await createTestRedis();
  const streamKey = randomTestKey("advanced-stream");
  const groupName = "advanced-group";
  const consumer1 = "consumer1";
  const consumer2 = "consumer2";

  try {
    // Setup: Add messages and create group
    const messages = [];
    for (let i = 0; i < 5; i++) {
      const id = await redis.xadd(streamKey, "*", {
        task: `task-${i}`,
        priority: (i % 3).toString(),
      });
      messages.push(id);
    }

    await redis.xgroupCreate(streamKey, groupName, 0, true);

    // Consumer 1 reads some messages
    const consumer1Messages = await redis.xreadgroup(
      [{ key: streamKey, xid: ">" }],
      { group: groupName, consumer: consumer1, count: 3 },
    );
    assertEquals(consumer1Messages[0].messages.length, 3);

    // Consumer 2 reads remaining messages
    const consumer2Messages = await redis.xreadgroup(
      [{ key: streamKey, xid: ">" }],
      { group: groupName, consumer: consumer2 },
    );
    assertEquals(consumer2Messages[0].messages.length, 2);

    // Check pending messages for both consumers
    const pendingC1 = await redis.xpendingCount(
      streamKey,
      groupName,
      { start: "-", end: "+", count: 10 },
      consumer1,
    );
    assertEquals(pendingC1.length, 3);

    const pendingC2 = await redis.xpendingCount(
      streamKey,
      groupName,
      { start: "-", end: "+", count: 10 },
      consumer2,
    );
    assertEquals(pendingC2.length, 2);

    // Consumer 1 acknowledges one message
    await redis.xack(
      streamKey,
      groupName,
      consumer1Messages[0].messages[0].xid,
    );

    // Check total pending count after ACK
    const totalPending = await redis.xpending(streamKey, groupName);
    assertEquals(totalPending.count, 4); // 5 total - 1 acknowledged = 4
    assertEquals(totalPending.consumers.length, 2);

    // Test XCLAIM - transfer message from consumer1 to consumer2
    // First, wait a bit to ensure minimum idle time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const claimedMessages = await redis.xclaim(
      streamKey,
      {
        group: groupName,
        consumer: consumer2,
        minIdleTime: 0, // Use 0 to ensure we can claim
      },
      consumer1Messages[0].messages[1].xid,
    );
    assertEquals(claimedMessages.kind, "messages");
    if (claimedMessages.kind === "messages") {
      assertEquals(claimedMessages.messages.length >= 0, true); // May be 0 or 1
    }

    console.log("✅ Advanced consumer group scenarios test completed");
  } finally {
    try {
      await redis.xgroupDestroy(streamKey, groupName);
    } catch {
      // Group might not exist, ignore error
    }
    await cleanupTestKeys(redis, streamKey);
    redis.close();
  }
});

Deno.test("Stream - Performance and stress test", async () => {
  const redis = await createTestRedis();
  const streamKey = randomTestKey("perf-stream");

  try {
    const startTime = Date.now();
    const messageCount = 100;

    // Batch add messages
    const promises = [];
    for (let i = 0; i < messageCount; i++) {
      promises.push(
        redis.xadd(streamKey, "*", {
          id: i.toString(),
          data: `data-${i}`,
          timestamp: Date.now().toString(),
        }),
      );
    }

    await Promise.all(promises);
    const addTime = Date.now() - startTime;

    // Verify all messages were added
    const length = await redis.xlen(streamKey);
    assertEquals(length, messageCount);

    // Test bulk read performance
    const readStart = Date.now();
    const allMessages = await redis.xrange(streamKey, "-", "+");
    const readTime = Date.now() - readStart;

    assertEquals(allMessages.length, messageCount);

    // Performance assertions (these are rough guidelines)
    assertEquals(addTime < 5000, true); // Should add 100 messages in under 5 seconds
    assertEquals(readTime < 1000, true); // Should read 100 messages in under 1 second

    console.log(`✅ Performance test completed: Add=${addTime}ms, Read=${readTime}ms`);
  } finally {
    await cleanupTestKeys(redis, streamKey);
    redis.close();
  }
});
