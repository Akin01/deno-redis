import { assertEquals } from "@std/assert";
import { connect } from "../mod.ts";
import { createTestRedis, TEST_REDIS_CONFIG, waitFor } from "./test_helper.ts";

Deno.test("PubSub - Basic subscription", async () => {
  const publisher = await createTestRedis();
  const subscriber = await connect(TEST_REDIS_CONFIG);

  try {
    const channel = "test-channel";
    const message = "hello world";
    let receivedMessage: string | null = null;

    // Subscribe to channel
    const sub = await subscriber.subscribe(channel);

    // Set up message receiver
    const messagePromise = (async () => {
      for await (const msg of sub.receive()) {
        receivedMessage = msg.message as string;
        break; // Exit after first message
      }
    })();

    // Wait a bit for subscription to be established
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Publish message
    const subscribers = await publisher.publish(channel, message);
    assertEquals(subscribers, 1);

    // Wait for message to be received
    let timeoutId: number;
    await Promise.race([
      messagePromise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Message not received in time")),
          2000,
        );
      }),
    ]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });

    assertEquals(receivedMessage, message);

    sub.close();
  } finally {
    publisher.close();
    subscriber.close();
  }
});

Deno.test("PubSub - Pattern subscription", async () => {
  const publisher = await createTestRedis();
  const subscriber = await connect(TEST_REDIS_CONFIG);

  try {
    const pattern = "test:*";
    const channel = "test:news";
    const message = "breaking news";
    let receivedMessage: any = null;

    // Subscribe to pattern
    const sub = await subscriber.psubscribe(pattern);

    // Set up message receiver
    const messagePromise = (async () => {
      for await (const msg of sub.receive()) {
        receivedMessage = msg;
        break;
      }
    })();

    // Wait for subscription
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Publish message
    await publisher.publish(channel, message);

    // Wait for message
    let timeoutId: number;
    await Promise.race([
      messagePromise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Pattern message not received")),
          2000,
        );
      }),
    ]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });

    assertEquals(receivedMessage?.pattern, pattern);
    assertEquals(receivedMessage?.channel, channel);
    assertEquals(receivedMessage?.message, message);

    sub.close();
  } finally {
    publisher.close();
    subscriber.close();
  }
});

Deno.test("PubSub - Multiple channels", async () => {
  const publisher = await createTestRedis();
  const subscriber = await connect(TEST_REDIS_CONFIG);

  try {
    const channels = ["channel1", "channel2", "channel3"];
    const messages = ["message1", "message2", "message3"];
    const receivedMessages: string[] = [];

    // Subscribe to multiple channels
    const sub = await subscriber.subscribe(...channels);

    // Set up message receiver
    const messagePromise = (async () => {
      for await (const msg of sub.receive()) {
        receivedMessages.push(msg.message as string);
        if (receivedMessages.length === 3) break;
      }
    })();

    // Wait for subscription
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Publish messages to all channels
    for (let i = 0; i < channels.length; i++) {
      await publisher.publish(channels[i], messages[i]);
    }

    // Wait for all messages
    let timeoutId: number;
    await Promise.race([
      messagePromise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Not all messages received")),
          3000,
        );
      }),
    ]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });

    assertEquals(receivedMessages.length, 3);

    // Check that all messages were received (order may vary)
    for (const msg of messages) {
      assertEquals(receivedMessages.includes(msg), true);
    }

    sub.close();
  } finally {
    publisher.close();
    subscriber.close();
  }
});

Deno.test("PubSub - Unsubscribe", async () => {
  const publisher = await createTestRedis();
  const subscriber = await connect(TEST_REDIS_CONFIG);

  try {
    const channel1 = "channel-keep";
    const channel2 = "channel-remove";
    let messageCount = 0;

    // Subscribe to both channels
    const sub = await subscriber.subscribe(channel1, channel2);

    // Set up message counter
    const messagePromise = (async () => {
      for await (const msg of sub.receive()) {
        messageCount++;
        // After first message, unsubscribe from channel2
        if (messageCount === 1) {
          await sub.unsubscribe(channel2);
        }
      }
    })();

    // Start message counter
    const counterPromise = messagePromise.catch(() => {}); // Ignore errors when we close

    // Wait for subscription
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Send first message to channel1
    await publisher.publish(channel1, "message1");

    // Wait for first message and unsubscribe
    await waitFor(() => messageCount >= 1, 1000);

    // Send message to unsubscribed channel (should not be received)
    await publisher.publish(channel2, "message2");

    // Send another message to subscribed channel
    await publisher.publish(channel1, "message3");

    // Wait a bit more
    await waitFor(() => messageCount >= 2, 1000);

    sub.close();

    // Should have received 2 messages (both from channel1)
    assertEquals(messageCount, 2);
  } finally {
    publisher.close();
    subscriber.close();
  }
});
