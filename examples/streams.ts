/**
 * Redis Streams Operations Example
 *
 * This comprehensive example demonstrates Redis Streams functionality including:
 * - Adding messages to streams with automatic and custom IDs
 * - Reading from streams with various strategies (by ID, count, blocking)
 * - Consumer groups for distributed message processing
 * - Stream range queries and information commands
 * - Real-time event processing patterns
 * - Stream trimming and memory management
 * - Advanced stream features and best practices
 *
 * Redis Streams are perfect for event sourcing, message queues, real-time analytics,
 * activity feeds, IoT data collection, and distributed processing systems.
 *
 * @example
 * ```bash
 * # Run this example
 * deno run -A examples/streams.ts
 * ```
 */

import { connect, type Redis, type RedisConnectOptions } from "../mod.ts";

/**
 * Configuration for Redis connections
 */
const REDIS_CONFIG: RedisConnectOptions = {
  hostname: Deno.env.get("REDIS_HOST") ?? "127.0.0.1",
  port: parseInt(Deno.env.get("REDIS_PORT") ?? "6379"),
  password: Deno.env.get("REDIS_PASSWORD"),
  db: parseInt(Deno.env.get("REDIS_DB") ?? "0"),
};

/**
 * Constants for stream and group names used in the examples.
 */
const STREAMS = {
  SENSOR_DATA: "sensor-data",
  TIME_SERIES: "time-series",
  TASK_QUEUE: "task-queue",
  APP_EVENTS: "application-events",
  MONITORING: "monitoring-stream",
  LARGE_STREAM: "large-stream",
};

const GROUPS = {
  TASK_PROCESSORS: "task-processors",
  EVENT_HANDLERS: "event-handlers",
  MONITORING_GROUP: "monitoring-group",
};

/**
 * Interface for sensor data structure
 */
interface SensorReading {
  sensor: string;
  value: string;
  location: string;
  timestamp: string;
  unit?: string;
  quality?: string;
}

/**
 * Interface for event data structure
 */
interface ApplicationEvent {
  type: string;
  user_id?: string;
  service?: string;
  message?: string;
  data?: string;
  timestamp: string;
}

/**
 * Helper function to convert an object to Redis-compatible field values
 * by removing undefined or null properties and converting values to strings.
 * @param obj The object to convert.
 * @returns A record of string keys and string values.
 */
function toRedisFieldValues<T extends Record<string, unknown>>(
  obj: T,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      result[key] = String(value);
    }
  }
  return result;
}

/**
 * Basic stream operations demonstration
 */
async function demonstrateBasicStreamOps(redis: Redis): Promise<void> {
  console.log("\n🌊 === Basic Stream Operations ===");

  const streamName = STREAMS.SENSOR_DATA;

  // Clean up any existing stream
  await redis.del(streamName);

  console.log(`📝 Adding messages to stream '${streamName}'...`);

  // Add messages with automatic ID generation
  const sensorData: SensorReading[] = [
    {
      sensor: "temperature",
      value: "23.5",
      location: "living-room",
      timestamp: Date.now().toString(),
      unit: "celsius",
      quality: "good",
    },
    {
      sensor: "humidity",
      value: "65",
      location: "bedroom",
      timestamp: Date.now().toString(),
      unit: "percent",
      quality: "excellent",
    },
    {
      sensor: "temperature",
      value: "24.1",
      location: "kitchen",
      timestamp: Date.now().toString(),
      unit: "celsius",
      quality: "good",
    },
  ];

  for (const data of sensorData) {
    const messageId = await redis.xadd(
      streamName,
      "*",
      toRedisFieldValues(data),
    );
    console.log(
      `✅ Added ${data.sensor} reading with ID: ${messageId.unixMs}-${messageId.seqNo}`,
    );
  }

  // Get stream length
  const streamLength = await redis.xlen(streamName);
  console.log(`📊 Stream length: ${streamLength} messages`);

  // Read all messages from beginning
  console.log("\n📖 Reading all messages from stream:");
  const allMessages = await redis.xread([{ key: streamName, xid: [0, 0] }]);

  for (const stream of allMessages) {
    console.log(`📦 Stream: ${stream.key}`);
    for (const message of stream.messages) {
      const data = message.fieldValues;
      console.log(`   🔹 ID: ${message.xid.unixMs}-${message.xid.seqNo}`);
      console.log(
        `   📊 ${data.sensor}: ${data.value}${data.unit} at ${data.location}`,
      );
    }
  }

  console.log("✅ Basic stream operations completed");
}

/**
 * Stream range queries demonstration
 */
async function demonstrateStreamQueries(redis: Redis): Promise<void> {
  console.log("\n🔍 === Stream Range Queries ===");

  const streamName = STREAMS.TIME_SERIES;

  // Clean up existing stream
  await redis.del(streamName);

  console.log(`📝 Creating time-series data in stream '${streamName}'...`);

  // Add timestamped messages
  const timeSeriesData = [
    { metric: "cpu_usage", value: "75.2", host: "server-1" },
    { metric: "memory_usage", value: "82.1", host: "server-1" },
    { metric: "disk_usage", value: "45.7", host: "server-1" },
    { metric: "cpu_usage", value: "68.9", host: "server-2" },
    { metric: "memory_usage", value: "91.3", host: "server-2" },
  ];

  const ids: { unixMs: number; seqNo: number }[] = [];
  for (const data of timeSeriesData) {
    const id = await redis.xadd(
      streamName,
      "*",
      toRedisFieldValues({
        ...data,
        timestamp: Date.now().toString(),
      }),
    );
    ids.push(id);
    await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay for different timestamps
  }

  // Range queries
  console.log("\n📊 Performing range queries:");

  // Get first 3 messages
  const firstThree = await redis.xrange(streamName, "-", "+", 3);
  console.log(`📄 First 3 messages:`);
  for (const message of firstThree) {
    const data = message.fieldValues;
    console.log(
      `   ${message.xid.unixMs}-${message.xid.seqNo}: ${data.metric}=${data.value} (${data.host})`,
    );
  }

  // Get messages in reverse order
  const lastTwo = await redis.xrevrange(streamName, "+", "-", 2);
  console.log(`📄 Last 2 messages (reverse order):`);
  for (const message of lastTwo) {
    const data = message.fieldValues;
    console.log(
      `   ${message.xid.unixMs}-${message.xid.seqNo}: ${data.metric}=${data.value} (${data.host})`,
    );
  }

  // Get messages from specific ID
  if (ids.length >= 3) {
    const fromSpecific = await redis.xrange(streamName, ids[2], "+");
    console.log(`📄 Messages from ID ${ids[2].unixMs}-${ids[2].seqNo}:`);
    for (const message of fromSpecific) {
      const data = message.fieldValues;
      console.log(
        `   ${message.xid.unixMs}-${message.xid.seqNo}: ${data.metric}=${data.value}`,
      );
    }
  }

  console.log("✅ Stream range queries completed");
}

/**
 * Consumer groups demonstration
 */
async function demonstrateConsumerGroups(redis: Redis): Promise<void> {
  console.log("\n👥 === Consumer Groups ===");

  const streamName = STREAMS.TASK_QUEUE;
  const groupName = GROUPS.TASK_PROCESSORS;

  // Clean up existing stream and groups
  await redis.del(streamName);

  console.log(`📝 Setting up task queue '${streamName}'...`);

  // Add initial tasks
  const tasks = [
    { task: "process_image", filename: "photo1.jpg", priority: "high" },
    { task: "send_email", recipient: "user@example.com", priority: "medium" },
    { task: "backup_data", database: "users", priority: "low" },
    { task: "generate_report", type: "monthly", priority: "high" },
    { task: "cleanup_temp", directory: "/tmp", priority: "low" },
  ];

  for (const task of tasks) {
    await redis.xadd(
      streamName,
      "*",
      toRedisFieldValues({
        ...task,
        created_at: Date.now().toString(),
        status: "pending",
      }),
    );
  }

  console.log(`✅ Added ${tasks.length} tasks to the queue.`);

  // Create consumer group - use "0" to read from beginning instead of "$" to read only new messages
  try {
    await redis.xgroupCreate(streamName, groupName, "0", true);
    console.log(`✅ Created consumer group: ${groupName}`);
  } catch (error) {
    console.log(`ℹ️ Consumer group ${groupName} already exists`);
  }

  // Simulate multiple consumers processing tasks
  console.log("\n🤖 Starting task processors...");

  const consumer1 = "processor-1";
  const consumer2 = "processor-2";

  // Consumer 1: Process high priority tasks
  const consumer1Handler = async () => {
    let processed = 0;
    console.log(`🤖 ${consumer1} starting...`);

    while (processed < 3) {
      try {
        const messages = await redis.xreadgroup(
          [{ key: streamName, xid: ">" }],
          {
            group: groupName,
            consumer: consumer1,
            count: 1,
            block: 1000,
          },
        );

        if (messages.length === 0) {
          console.log(`ℹ️ ${consumer1} no new messages, continuing...`);
          continue;
        }

        for (const stream of messages) {
          for (const message of stream.messages) {
            const task = message.fieldValues;
            console.log(
              `🔄 ${consumer1} processing: ${task.task} (${task.priority})`,
            );

            // Simulate processing time
            await new Promise((resolve) => setTimeout(resolve, 200));

            // Acknowledge successful processing
            await redis.xack(streamName, groupName, message.xid);
            console.log(`✅ ${consumer1} completed: ${task.task}`);
            processed++;
          }
        }
      } catch (error) {
        console.log(`⚠️ ${consumer1} error:`, error);
        break;
      }
    }

    console.log(`🏁 ${consumer1} finished processing`);
  };

  // Consumer 2: Process remaining tasks
  const consumer2Handler = async () => {
    let processed = 0;
    console.log(`🤖 ${consumer2} starting...`);

    while (processed < 2) {
      try {
        const messages = await redis.xreadgroup(
          [{ key: streamName, xid: ">" }],
          {
            group: groupName,
            consumer: consumer2,
            count: 1,
            block: 1000,
          },
        );

        if (messages.length === 0) {
          console.log(`ℹ️ ${consumer2} no new messages, continuing...`);
          continue;
        }

        for (const stream of messages) {
          for (const message of stream.messages) {
            const task = message.fieldValues;
            console.log(
              `🔄 ${consumer2} processing: ${task.task} (${task.priority})`,
            );

            // Simulate processing time
            await new Promise((resolve) => setTimeout(resolve, 150));

            // Acknowledge successful processing
            await redis.xack(streamName, groupName, message.xid);
            console.log(`✅ ${consumer2} completed: ${task.task}`);
            processed++;
          }
        }
      } catch (error) {
        console.log(`⚠️ ${consumer2} error:`, error);
        break;
      }
    }

    console.log(`🏁 ${consumer2} finished processing`);
  };

  // Run consumers concurrently
  await Promise.all([consumer1Handler(), consumer2Handler()]);

  // Check pending messages
  try {
    const pendingInfo = await redis.xpending(streamName, groupName);
    console.log(`📊 Pending messages: ${pendingInfo.count}`);
  } catch (error) {
    console.log(`ℹ️ Could not check pending messages: ${error}`);
  }

  console.log("✅ Consumer groups demonstration completed");
}

/**
 * Real-time event processing demonstration
 */
async function demonstrateRealTimeProcessing(redis: Redis): Promise<void> {
  console.log("\n⚡ === Real-time Event Processing ===");

  const eventStream = STREAMS.APP_EVENTS;
  const processingGroup = GROUPS.EVENT_HANDLERS;

  // Clean up existing streams
  await redis.del(eventStream);

  // Create consumer group for real-time processing
  try {
    await redis.xgroupCreate(eventStream, processingGroup, "0", true);
    console.log(
      `✅ Created consumer group '${processingGroup}' for stream '${eventStream}'.`,
    );
  } catch {
    console.log(`ℹ️ Consumer group '${processingGroup}' already exists.`);
  }

  // Event producer simulation
  const produceEvents = async () => {
    const events: ApplicationEvent[] = [
      { type: "user_login", user_id: "1001", timestamp: Date.now().toString() },
      {
        type: "purchase",
        user_id: "1002",
        data: "product_id:123,amount:99.99",
        timestamp: Date.now().toString(),
      },
      {
        type: "page_view",
        user_id: "1003",
        data: "page:/dashboard",
        timestamp: Date.now().toString(),
      },
      {
        type: "user_logout",
        user_id: "1001",
        timestamp: Date.now().toString(),
      },
      {
        type: "error",
        service: "payment",
        message: "connection timeout",
        timestamp: Date.now().toString(),
      },
      {
        type: "system_alert",
        service: "database",
        message: "high cpu usage",
        timestamp: Date.now().toString(),
      },
    ];

    console.log("📤 Starting event production...");

    for (const event of events) {
      await redis.xadd(eventStream, "*", toRedisFieldValues(event));
      console.log(
        `📨 Produced: ${event.type}${event.user_id ? ` (user: ${event.user_id})` : ""
        }`,
      );
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    console.log("✅ Event production completed");
  };

  // Event consumer simulation
  const consumeEvents = async () => {
    console.log("👂 Event consumer starting...");

    let processedCount = 0;
    const maxEvents = 6;

    while (processedCount < maxEvents) {
      try {
        const events = await redis.xreadgroup(
          [{ key: eventStream, xid: ">" }],
          {
            group: processingGroup,
            consumer: "event-processor-1",
            count: 1,
            block: 2000,
          },
        );

        if (events.length === 0) {
          console.log("ℹ️ No events received, waiting...");
          continue;
        }

        for (const stream of events) {
          for (const message of stream.messages) {
            const event = message.fieldValues;

            // Process different event types
            switch (event.type) {
              case "user_login":
                console.log(`🔐 Login processed for user ${event.user_id}`);
                break;
              case "purchase":
                console.log(`💰 Purchase processed: ${event.data}`);
                break;
              case "error":
                console.log(
                  `❌ Error handled in ${event.service}: ${event.message}`,
                );
                break;
              case "system_alert":
                console.log(
                  `⚠️ System alert: ${event.service} - ${event.message}`,
                );
                break;
              default:
                console.log(`📝 Event processed: ${event.type}`);
            }

            // Simulate processing time
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Acknowledge processing
            await redis.xack(eventStream, processingGroup, message.xid);
            processedCount++;
          }
        }
      } catch (error) {
        console.log("⚠️ Event processing error:", error);
        break;
      }
    }

    console.log("✅ Event processing completed");
  };

  // Run producer and consumer concurrently
  await Promise.all([produceEvents(), consumeEvents()]);

  console.log("✅ Real-time processing demonstration completed");
}

/**
 * Stream information and monitoring demonstration
 */
async function demonstrateStreamInfo(redis: Redis): Promise<void> {
  console.log("\n📊 === Stream Information & Monitoring ===");

  const streamName = STREAMS.MONITORING;

  // Create a stream with some data
  await redis.del(streamName);

  console.log(`📝 Populating stream '${streamName}' for monitoring...`);
  for (let i = 1; i <= 5; i++) {
    await redis.xadd(
      streamName,
      "*",
      toRedisFieldValues({
        metric: `metric_${i}`,
        value: (Math.random() * 100).toFixed(2),
        timestamp: Date.now().toString(),
      }),
    );
  }

  // Get detailed stream information
  const streamInfo = await redis.xinfoStream(streamName);
  console.log("📈 Stream Information:");
  console.log(`   Length: ${streamInfo.length} messages`);
  console.log(
    `   First entry: ${streamInfo.firstEntry?.xid.unixMs}-${streamInfo.firstEntry?.xid.seqNo}`,
  );
  console.log(
    `   Last entry: ${streamInfo.lastEntry?.xid.unixMs}-${streamInfo.lastEntry?.xid.seqNo}`,
  );
  console.log(`   Groups: ${streamInfo.groups}`);
  console.log(`   Radix tree keys: ${streamInfo.radixTreeKeys}`);

  // Create a consumer group for monitoring
  const groupName = GROUPS.MONITORING_GROUP;
  try {
    await redis.xgroupCreate(streamName, groupName, "$", true);
    console.log(`✅ Created consumer group '${groupName}'.`);
  } catch {
    // Group already exists
    console.log(`ℹ️ Consumer group '${groupName}' already exists.`);
  }

  // Read some messages to create consumer info
  try {
    await redis.xreadgroup(
      [{ key: streamName, xid: ">" }],
      {
        group: groupName,
        consumer: "monitor-1",
        count: 2,
      },
    );
  } catch (error) {
    console.log(`ℹ️ No new messages to read: ${error}`);
  }

  // Get consumer group information
  try {
    const groupInfo = await redis.xinfoGroups(streamName);
    console.log(`\n👥 Consumer Groups: ${groupInfo.length}`);
    for (const group of groupInfo) {
      console.log(`   Group: ${group.name}`);
      console.log(`     Consumers: ${group.consumers}`);
      console.log(`     Pending: ${group.pending}`);
      console.log(`     Last delivered: ${group.lastDeliveredId}`);
    }
  } catch (error) {
    console.log(`ℹ️ Could not get group info: ${error}`);
  }

  // Get consumer information
  try {
    const consumerInfo = await redis.xinfoConsumers(streamName, groupName);
    console.log(`\n🤖 Consumers in group '${groupName}':`);
    for (const consumer of consumerInfo) {
      console.log(`   Consumer: ${consumer.name}`);
      console.log(`     Pending: ${consumer.pending}`);
      console.log(`     Idle time: ${consumer.idle}ms`);
    }
  } catch (error) {
    console.log(`ℹ️ Could not get consumer info: ${error}`);
  }

  console.log("✅ Stream monitoring demonstration completed");
}

/**
 * Stream trimming and memory management demonstration
 */
async function demonstrateStreamTrimming(redis: Redis): Promise<void> {
  console.log("\n✂️ === Stream Trimming & Memory Management ===");

  const streamName = STREAMS.LARGE_STREAM;

  // Clean up and create a large stream
  await redis.del(streamName);

  console.log(`📝 Creating large stream '${streamName}' for trimming demonstration...`);

  // Add many messages
  const messageCount = 20;
  for (let i = 1; i <= messageCount; i++) {
    await redis.xadd(
      streamName,
      "*",
      toRedisFieldValues({
        sequence: i.toString(),
        data: `message_${i}`,
        timestamp: Date.now().toString(),
      }),
    );
  }

  const beforeTrim = await redis.xlen(streamName);
  console.log(`📏 Stream length before trimming: ${beforeTrim} messages`);

  // Trim to keep only the latest 10 messages (approximate)
  console.log("✂️ Trimming stream to keep ~10 messages...");
  const trimmedCount = await redis.xtrim(streamName, {
    approx: true,
    elements: 10,
  });
  console.log(`🗑️ Trimmed ${trimmedCount} messages`);

  const afterTrim = await redis.xlen(streamName);
  console.log(`📏 Stream length after trimming: ${afterTrim} messages`);

  // Show remaining messages
  const remaining = await redis.xrange(streamName, "-", "+");
  console.log("📄 Remaining messages:");
  for (const message of remaining) {
    const data = message.fieldValues;
    console.log(
      `   ${message.xid.unixMs}-${message.xid.seqNo}: sequence=${data.sequence}`,
    );
  }

  // Note: This example uses the MAXLEN trimming strategy.
  // The MINID strategy is not demonstrated here.

  console.log("✅ Stream trimming demonstration completed");
}

/**
 * Error handling for stream operations
 */
async function handleStreamError(error: unknown): Promise<void> {
  console.error("\n❌ An error occurred during stream operations:");
  if (error instanceof Error) {
    console.error(`   - Type: ${error.constructor.name}`);
    console.error(`   - Message: ${error.message}`);
    if (error.stack) {
      console.error(
        `   - Stack: ${error.stack.split("\n").slice(1, 4).join("\n")}`,
      );
    }
  } else {
    console.error(`   - Error: ${String(error)}`);
  }
}

/**
 * Main streams example function
 */
async function streamsExample(): Promise<void> {
  console.log("🌊 Redis Streams Operations Example");
  console.log("=".repeat(60));

  let redis: Redis | null = null;

  try {
    // Connect to Redis
    console.log("🔗 Connecting to Redis...");
    redis = await connect(REDIS_CONFIG);
    console.log("✅ Connected to Redis successfully");

    // Run all demonstrations
    await demonstrateBasicStreamOps(redis);
    await demonstrateStreamQueries(redis);
    await demonstrateConsumerGroups(redis);
    await demonstrateRealTimeProcessing(redis);
    await demonstrateStreamInfo(redis);
    await demonstrateStreamTrimming(redis);

    console.log("\n🎉 All stream operations completed successfully!");
    console.log("\n💡 Key Takeaways:");
    console.log("   • Streams provide persistent, ordered message storage");
    console.log("   • Consumer groups enable distributed processing");
    console.log("   • Range queries allow flexible message retrieval");
    console.log("   • Real-time processing with blocking reads");
    console.log("   • Stream trimming helps manage memory usage");
    console.log("   • Rich monitoring and information commands available");
  } catch (error) {
    await handleStreamError(error);
  } finally {
    // Cleanup
    if (redis) {
      console.log("\n🧹 Cleaning up test streams...");
      try {
        await redis.del(...Object.values(STREAMS));
        console.log("✅ Test streams cleaned up");
      } catch (cleanupError) {
        console.log("⚠️ Cleanup warning:", cleanupError);
      }

      redis.close();
      console.log("👋 Redis connection closed");
    }
  }
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown() {
  const cleanup = () => {
    console.log("\n⚠️ Received shutdown signal, cleaning up...");
    Deno.exit(0);
  };

  // Handle Ctrl+C
  Deno.addSignalListener("SIGINT", cleanup);

  // Handle SIGTERM (Unix-like systems only)
  if (Deno.build.os !== "windows") {
    Deno.addSignalListener("SIGTERM", cleanup);
  }
}

// Run the example if this file is executed directly
if (import.meta.main) {
  setupGracefulShutdown();
  await streamsExample();
}
