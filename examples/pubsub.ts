/**
 * Redis Pub/Sub Operations Example
 *
 * This comprehensive example demonstrates Redis publish/subscribe messaging including:
 * - Basic channel subscriptions and message publishing
 * - Pattern-based subscriptions for flexible message routing
 * - Multiple subscribers and message broadcasting
 * - Real-time messaging patterns and best practices
 * - Graceful connection management and cleanup
 * - Error handling and recovery strategies
 *
 * Redis Pub/Sub is ideal for real-time applications like chat systems,
 * live notifications, event broadcasting, and microservice communication.
 *
 * @example
 * ```bash
 * # Run this example
 * deno run -A examples/pubsub.ts
 * ```
 */

import { connect, type Redis, type RedisConnectOptions } from "../mod.ts";

/**
 * Configuration for Redis connections optimized for pub/sub
 */
const REDIS_CONFIG: RedisConnectOptions = {
  hostname: Deno.env.get("REDIS_HOST") ?? "127.0.0.1",
  port: parseInt(Deno.env.get("REDIS_PORT") ?? "6379"),
  password: Deno.env.get("REDIS_PASSWORD"),
  db: parseInt(Deno.env.get("REDIS_DB") ?? "0"),
};

/**
 * Interface for message handling statistics
 */
interface MessageStats {
  channelMessages: Map<string, number>;
  patternMessages: Map<string, number>;
  totalMessages: number;
  startTime: number;
}

/**
 * Utility to create a delay.
 * @param ms Milliseconds to delay.
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Basic channel subscription demonstration
 */
async function demonstrateBasicPubSub(
  publisher: Redis,
  subscriber: Redis,
): Promise<void> {
  console.log("\n📢 === Basic Channel Subscription ===");

  const newsChannel = "news";
  const sportsChannel = "sports";

  // Subscribe to specific channels
  const sub = await subscriber.subscribe(newsChannel, sportsChannel);
  console.log(`✅ Subscribed to channels: ${newsChannel}, ${sportsChannel}`);

  // Set up message handler
  let messageCount = 0;
  const messageHandler = async () => {
    console.log("👂 Listening for messages...");

    for await (const message of sub.receive()) {
      messageCount++;
      console.log(`📨 Message ${messageCount}:`);
      console.log(`   Channel: ${message.channel}`);
      console.log(`   Message: ${message.message}`);

      // Stop after receiving 3 messages
      if (messageCount >= 3) {
        break;
      }
    }
  };

  // Start listening in background
  const listenerPromise = messageHandler();

  // Give subscriber time to set up
  await delay(100);

  // Publish some messages
  console.log("\n📤 Publishing messages...");

  const subscribers1 = await publisher.publish(
    newsChannel,
    "Breaking: Deno 2.0 released!",
  );
  console.log(`📮 Published to news channel (${subscribers1} subscribers)`);

  const subscribers2 = await publisher.publish(
    sportsChannel,
    "Goal! Team A scores!",
  );
  console.log(`📮 Published to sports channel (${subscribers2} subscribers)`);

  const subscribers3 = await publisher.publish(
    newsChannel,
    "Weather update: Sunny day ahead",
  );
  console.log(
    `📮 Published another news message (${subscribers3} subscribers)`,
  );

  // Wait for messages to be received
  await listenerPromise;

  // Unsubscribe from channels but don't close the connection
  await sub.unsubscribe(newsChannel, sportsChannel);
  console.log("✅ Unsubscribed from basic channels");
}

/**
 * Pattern-based subscription demonstration
 */
async function demonstratePatternSubscriptions(
  publisher: Redis,
  subscriber: Redis,
): Promise<void> {
  console.log("\n🔍 === Pattern Subscription ===");

  const patternSub = await subscriber.psubscribe("user:*", "log:*");
  console.log("✅ Subscribed to patterns: user:*, log:*");

  // Pattern message handler
  let patternMessageCount = 0;
  const patternHandler = async () => {
    console.log("👂 Listening for pattern messages...");

    for await (const message of patternSub.receive()) {
      patternMessageCount++;
      console.log(`📨 Pattern Message ${patternMessageCount}:`);
      console.log(`   Pattern: ${message.pattern}`);
      console.log(`   Channel: ${message.channel}`);
      console.log(`   Message: ${message.message}`);

      if (patternMessageCount >= 3) {
        break;
      }
    }
  };

  const patternListenerPromise = patternHandler();

  // Give time to set up
  await delay(100);

  // Publish to channels matching patterns
  console.log("\n📤 Publishing to pattern-matching channels...");

  await publisher.publish("user:1001", "User logged in");
  console.log("📮 Published to user:1001");

  await publisher.publish("user:1002", "User updated profile");
  console.log("📮 Published to user:1002");

  await publisher.publish("log:error", "Database connection failed");
  console.log("📮 Published to log:error");

  await publisher.publish("random:channel", "This won't match any pattern");
  console.log("📮 Published to random:channel (won't be received)");

  // Wait for pattern messages
  await patternListenerPromise;

  patternSub.close();
  console.log("✅ Closed pattern subscription");
}

/**
 * Multiple subscribers demonstration
 */
async function demonstrateMultipleSubscribers(
  publisher: Redis,
  subscriber1: Redis,
  subscriber2: Redis,
): Promise<void> {
  console.log("\n👥 === Multiple Subscribers ===");

  const broadcastChannel = "broadcast";

  // Create multiple subscribers
  const sub1 = await subscriber1.subscribe(broadcastChannel);
  const sub2 = await subscriber2.subscribe(broadcastChannel);

  console.log("✅ Set up 2 subscribers for broadcast channel");

  // Count messages for each subscriber
  let sub1Count = 0;
  let sub2Count = 0;

  const sub1Handler = async () => {
    for await (const message of sub1.receive()) {
      sub1Count++;
      console.log(`📨 Subscriber 1 received: ${message.message}`);
      if (sub1Count >= 2) break;
    }
  };

  const sub2Handler = async () => {
    for await (const message of sub2.receive()) {
      sub2Count++;
      console.log(`📨 Subscriber 2 received: ${message.message}`);
      if (sub2Count >= 2) break;
    }
  };

  // Start both handlers
  const sub1Promise = sub1Handler();
  const sub2Promise = sub2Handler();

  // Give time to set up
  await delay(100);

  // Publish broadcast messages
  console.log("\n📤 Broadcasting messages...");

  const subscriberCount1 = await publisher.publish(
    broadcastChannel,
    "Hello everyone!",
  );
  console.log(
    `📮 Broadcast message 1 - Reached ${subscriberCount1} subscribers`,
  );

  const subscriberCount2 = await publisher.publish(
    broadcastChannel,
    "This is a broadcast!",
  );
  console.log(
    `📮 Broadcast message 2 - Reached ${subscriberCount2} subscribers`,
  );

  // Wait for all handlers to complete
  await Promise.all([sub1Promise, sub2Promise]);

  console.log(`📊 Final counts - Sub1: ${sub1Count}, Sub2: ${sub2Count}`);

  // Clean up
  sub1.close();
  sub2.close();

  console.log("✅ Multiple subscribers demonstration completed");
}

/**
 * Real-time messaging simulation
 */
async function demonstrateRealTimeMessaging(
  publisher: Redis,
  subscriber: Redis,
): Promise<void> {
  console.log("\n⚡ === Real-time Messaging Simulation ===");

  const chatChannel = "chat:room1";
  const sub = await subscriber.subscribe(chatChannel);

  console.log("✅ Subscribed to chat room");

  // Simulate chat messages
  const chatMessages = [
    "Alice: Hello everyone!",
    "Bob: Hi Alice, how are you?",
    "Charlie: Great to see you both here!",
    "Alice: This Redis pub/sub is really fast!",
    "Bob: Agreed, perfect for real-time chat!",
  ];

  let messageCount = 0;
  const chatHandler = async () => {
    console.log("👂 Chat room is now active...");

    for await (const message of sub.receive()) {
      console.log(`💬 ${message.message}`);
      messageCount++;

      if (messageCount >= chatMessages.length) {
        break;
      }
    }
  };

  const chatPromise = chatHandler();

  // Give time to set up
  await delay(100);

  // Simulate real-time message publishing
  console.log("📤 Starting chat simulation...");

  for (const chatMessage of chatMessages) {
    await publisher.publish(chatChannel, chatMessage);
    // Simulate typing delay
    await delay(500);
  }

  await chatPromise;
  sub.close();

  console.log("✅ Chat simulation completed");
}

/**
 * Channel management demonstration
 */
async function demonstrateChannelManagement(
  publisher: Redis,
  subscriber: Redis,
): Promise<void> {
  console.log("\n🔧 === Channel Management ===");

  // Start with no subscriptions
  console.log("📊 Demonstrating dynamic subscription management...");

  const managedSub = await subscriber.subscribe("initial:channel");

  // Add more channels before starting to receive
  console.log("➕ Adding more channels to subscription...");
  await managedSub.subscribe("dynamic:channel1", "dynamic:channel2");

  let messageCount = 0;
  const managementHandler = async () => {
    for await (const message of managedSub.receive()) {
      messageCount++;
      console.log(`📨 Received on ${message.channel}: ${message.message}`);

      if (messageCount >= 3) break; // Adjusted since we'll receive fewer messages
    }
  };

  const managementPromise = managementHandler();

  await delay(100);

  // Publish to different channels
  await publisher.publish("initial:channel", "Message to initial channel");
  await publisher.publish("dynamic:channel1", "Message to dynamic channel 1");
  await publisher.publish("dynamic:channel2", "Message to dynamic channel 2");

  await managementPromise;

  // Demonstrate unsubscribing (create a new subscription for this)
  console.log("➖ Demonstrating unsubscribe functionality...");
  const unsubSub = await subscriber.subscribe("temp:channel");

  // Publish a message that will be received
  await publisher.publish("temp:channel", "Message before unsubscribe");

  // Wait a bit for the message to be processed
  await delay(100);

  // Unsubscribe from the temporary channel
  await unsubSub.unsubscribe("temp:channel");

  // This message won't be received since we unsubscribed
  await publisher.publish("temp:channel", "This won't be received");

  managedSub.close();
  console.log("✅ Channel management demonstration completed");
}

/**
 * Advanced pub/sub patterns demonstration
 */
async function demonstrateAdvancedPatterns(
  publisher: Redis,
  subscriber: Redis,
): Promise<void> {
  console.log("\n🚀 === Advanced Pub/Sub Patterns ===");

  // Message statistics tracking
  const stats: MessageStats = {
    channelMessages: new Map(),
    patternMessages: new Map(),
    totalMessages: 0,
    startTime: Date.now(),
  };

  // Subscribe to multiple patterns for comprehensive monitoring
  const monitoringSub = await subscriber.psubscribe(
    "app:*",
    "system:*",
    "user:*",
  );
  console.log("✅ Subscribed to monitoring patterns: app:*, system:*, user:*");

  const monitoringHandler = async () => {
    console.log("👂 Starting message monitoring...");

    for await (const message of monitoringSub.receive()) {
      stats.totalMessages++;

      // Track pattern statistics
      const pattern = message.pattern!;
      stats.patternMessages.set(
        pattern,
        (stats.patternMessages.get(pattern) || 0) + 1,
      );

      // Track channel statistics
      stats.channelMessages.set(
        message.channel,
        (stats.channelMessages.get(message.channel) || 0) + 1,
      );

      console.log(
        `📊 [${stats.totalMessages}] ${message.channel} (${pattern}): ${message.message}`,
      );

      if (stats.totalMessages >= 8) break;
    }
  };

  const monitoringPromise = monitoringHandler();

  await delay(100);

  // Simulate application events
  console.log("📤 Simulating application events...");

  const events = [
    { channel: "app:login", message: "User authentication successful" },
    { channel: "app:logout", message: "User session terminated" },
    { channel: "system:health", message: "System health check passed" },
    { channel: "system:error", message: "Database connection timeout" },
    { channel: "user:profile", message: "Profile updated successfully" },
    { channel: "user:notification", message: "New message received" },
    { channel: "app:purchase", message: "Payment processed successfully" },
    { channel: "system:backup", message: "Daily backup completed" },
  ];

  for (const event of events) {
    await publisher.publish(event.channel, event.message);
    await delay(200);
  }

  await monitoringPromise;

  // Display statistics
  console.log("\n📈 Message Statistics:");
  console.log(`   Total messages: ${stats.totalMessages}`);
  console.log(`   Processing time: ${Date.now() - stats.startTime}ms`);
  console.log("   Pattern breakdown:");
  for (const [pattern, count] of stats.patternMessages) {
    console.log(`     ${pattern}: ${count} messages`);
  }

  monitoringSub.close();
  console.log("✅ Advanced patterns demonstration completed");
}

/**
 * Error handling for pub/sub operations
 */
async function handlePubSubError(error: unknown): Promise<void> {
  console.error("❌ Pub/Sub Error occurred:");
  if (error instanceof Error) {
    console.error(`   Type: ${error.constructor.name}`);
    console.error(`   Message: ${error.message}`);
    if (error.stack) {
      console.error(
        `   Stack: ${error.stack.split("\n").slice(0, 3).join("\n")}`,
      );
    }
  } else {
    console.error(`   Error: ${String(error)}`);
  }
}

/**
 * Cleanup function for pub/sub resources
 */
async function cleanupConnections(
  connections: (Redis | null)[],
): Promise<void> {
  console.log("\n🧹 Cleaning up pub/sub resources...");
  for (const conn of connections) {
    if (conn) {
      try {
        conn.close();
        console.log(`✅ Connection closed`);
      } catch (error) {
        console.error("⚠️ Error during cleanup:", error);
      }
    }
  }
}

/**
 * Main function demonstrating pub/sub operations
 */
async function pubSubExample(): Promise<void> {
  console.log("📡 Redis Pub/Sub Operations Example");
  console.log("=".repeat(60));

  // A single publisher connection can be reused.
  const publisher = await connect(REDIS_CONFIG);
  console.log("✅ Publisher connection established");

  try {
    // Each subscriber or group of subscribers needs a dedicated connection.
    // This wrapper simplifies connection setup and teardown for each demo.
    const withSubscribers = async (
      subscriberCount: number,
      demonstration: (
        publisher: Redis,
        ...subscribers: Redis[]
      ) => Promise<void>,
    ) => {
      const subscribers = await Promise.all(
        Array.from({ length: subscriberCount }, () => connect(REDIS_CONFIG)),
      );
      try {
        await demonstration(publisher, ...subscribers);
      } finally {
        subscribers.forEach((s) => s.close());
      }
    };

    // Core pub/sub demonstrations
    await withSubscribers(1, demonstrateBasicPubSub);
    await withSubscribers(1, demonstratePatternSubscriptions);
    await withSubscribers(2, demonstrateMultipleSubscribers);
    await withSubscribers(1, demonstrateRealTimeMessaging);
    await withSubscribers(1, demonstrateChannelManagement);
    await withSubscribers(1, demonstrateAdvancedPatterns);

    console.log("\n🎉 All pub/sub operations completed successfully!");
    console.log("\n💡 Key Takeaways:");
    console.log(
      "   • Use separate connections for publishers and subscribers.",
    );
    console.log("   • Pattern subscriptions provide flexible message routing.");
    console.log("   • Multiple subscribers enable message broadcasting.");
    console.log(
      "   • Dynamic subscription management allows runtime flexibility.",
    );
    console.log("   • Always handle errors and clean up resources properly.");
  } catch (error) {
    await handlePubSubError(error);
  } finally {
    await cleanupConnections([publisher]);
  }
}

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async () => {
  console.log("\n🔔 Signal received, shutting down gracefully...");
  await cleanupConnections([publisher]);
  Deno.exit(0);
};

Deno.addSignalListener("SIGINT", gracefulShutdown);
Deno.addSignalListener("SIGTERM", gracefulShutdown);

if (import.meta.main) {
  // Execute the example
  await pubSubExample();
}
