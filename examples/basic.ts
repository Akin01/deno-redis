/**
 * Basic Redis Operations Example
 *
 * This comprehensive example demonstrates fundamental Redis operations including:
 * - Establishing secure connections with proper configuration
 * - String operations (GET, SET, INCR, DECR, SETEX)
 * - Hash operations (HSET, HGET, HMGET, HGETALL)
 * - List operations (LPUSH, RPUSH, LRANGE, LPOP, RPOP)
 * - Key management (EXISTS, EXPIRE, TTL, DEL)
 * - Comprehensive error handling with proper error types
 * - Resource cleanup and connection management
 *
 * @example
 * ```bash
 * # Run this example
 * deno run -A examples/basic.ts
 * ```
 */

import {
  connect,
  ConnectionClosedError,
  ErrorReplyError,
  type Redis,
  type RedisConnectOptions,
} from "../mod.ts";

/**
 * Type alias for Redis keys for improved readability.
 */
type RedisKey = string;

/**
 * Type alias for Redis values for improved readability.
 */
type RedisValue = string | number;

/**
 * Configuration interface for Redis connection.
 */
interface RedisConfig extends RedisConnectOptions {
  hostname: string;
  port: number;
  password?: string;
  db?: number;
  name?: string;
}

/**
 * Default Redis configuration for examples.
 * Reads from environment variables with sensible defaults.
 */
const DEFAULT_CONFIG: RedisConfig = {
  hostname: Deno.env.get("REDIS_HOST") ?? "127.0.0.1",
  port: parseInt(Deno.env.get("REDIS_PORT") ?? "6379"),
  password: Deno.env.get("REDIS_PASSWORD"),
  db: parseInt(Deno.env.get("REDIS_DB") ?? "0"),
  name: "basic-example-client",
};

/**
 * Main function demonstrating basic Redis operations.
 * This function orchestrates the connection, command demonstrations, and cleanup.
 */
async function basicExample(): Promise<void> {
  console.log("🔗 Connecting to Redis...");
  console.log(`📍 Host: ${DEFAULT_CONFIG.hostname}:${DEFAULT_CONFIG.port}`);

  let redis: Redis | null = null;

  try {
    // Establish connection with timeout and retry logic
    redis = await connectWithRetry(DEFAULT_CONFIG);

    console.log("✅ Successfully connected to Redis!");
    console.log(
      `🔌 Connection status: Connected=${redis.isConnected}, Closed=${redis.isClosed}`,
    );

    // Verify connection health before proceeding
    await verifyConnection(redis);

    // Demonstrate core Redis operations by category
    await demonstrateStringOperations(redis);
    await demonstrateHashOperations(redis);
    await demonstrateListOperations(redis);
    await demonstrateKeyOperations(redis);

    console.log("🎉 All basic operations completed successfully!");
  } catch (error) {
    await handleError(error);
  } finally {
    // Ensure resources are always cleaned up
    await cleanup(redis);
  }
}

/**
 * Connect to Redis with retry logic and proper error handling.
 * Implements exponential backoff for connection attempts.
 */
async function connectWithRetry(
  config: RedisConfig,
  maxRetries = 3,
): Promise<Redis> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Connection attempt ${attempt}/${maxRetries}...`);

      const redis = await connect(config);

      // Test the connection immediately to ensure it's responsive
      await redis.ping();

      return redis;
    } catch (error) {
      lastError = error as Error;
      console.warn(`⚠️ Attempt ${attempt} failed: ${lastError.message}`);

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // If all retries fail, throw a comprehensive error
  throw new Error(
    `Failed to connect after ${maxRetries} attempts. Last error: ${
      lastError!.message
    }`,
  );
}

/**
 * Verify Redis connection health by pinging the server and fetching info.
 */
async function verifyConnection(redis: Redis): Promise<void> {
  const start = performance.now();
  const pong = await redis.ping();
  const latency = performance.now() - start;

  console.log(`📡 Ping response: ${pong} (${latency.toFixed(2)}ms)`);

  // Get server info for debugging and context
  const info = await redis.info("server");
  const redisVersion = info.match(/redis_version:([^\r\n]+)/)?.[1];
  if (redisVersion) {
    console.log(`🔧 Redis version: ${redisVersion}`);
  }
}

/**
 * Demonstrate Redis string operations with comprehensive examples.
 */
async function demonstrateStringOperations(redis: Redis): Promise<void> {
  console.log("\n📝 String Operations:");
  console.log("=".repeat(50));

  try {
    // Basic SET/GET operations
    await redis.set("app:welcome", "Hello, Redis from Deno!");
    const welcome = await redis.get("app:welcome");
    console.log(`✅ SET/GET: ${welcome}`);

    // Set with expiration (SETEX) for temporary data
    const expireSeconds = 30;
    await redis.setex(
      "session:temp",
      expireSeconds,
      JSON.stringify({
        userId: 1001,
        loginTime: new Date().toISOString(),
      }),
    );

    const ttl = await redis.ttl("session:temp");
    console.log(`⏰ SETEX: Session expires in ${ttl} seconds`);

    // Atomic increment operations for counters
    await redis.set("metrics:page_views", "0");
    const views1 = await redis.incr("metrics:page_views");
    const views2 = await redis.incrby("metrics:page_views", 5);
    console.log(`📊 INCR: ${views1} → ${views2} page views`);

    // Atomic decrement operations for inventory management
    await redis.set("inventory:widgets", "100");
    const stock1 = await redis.decr("inventory:widgets");
    const stock2 = await redis.decrby("inventory:widgets", 10);
    console.log(`📦 DECR: 100 → ${stock1} → ${stock2} widgets in stock`);

    // Conditional SET operations (SET if Not eXists)
    const setResult1 = await redis.setnx("config:maintenance", "true");
    const setResult2 = await redis.setnx("config:maintenance", "false"); // Should fail
    console.log(`🔒 SETNX: First set=${setResult1}, Second set=${setResult2}`);

    // Multiple SET/GET operations for efficiency
    await redis.mset({
      "user:1:name": "Alice",
      "user:1:email": "alice@example.com",
    });
    const userInfo = await redis.mget(
      "user:1:name",
      "user:1:email",
      "user:1:phone", // This key does not exist
    );
    console.log(
      `👥 MSET/MGET: Name=${userInfo[0]}, Email=${userInfo[1]}, Phone=${
        userInfo[2] ?? "not set"
      }`,
    );

    // String append operations
    await redis.set("log:entry", "ERROR: ");
    const newLength = await redis.append(
      "log:entry",
      "Database connection failed",
    );
    const logEntry = await redis.get("log:entry");
    console.log(`📝 APPEND: "${logEntry}" (length: ${newLength})`);
  } catch (error) {
    console.error(`❌ String operations error: ${(error as Error).message}`);
    throw error; // Re-throw to be caught by the main handler
  }
}

/**
 * Demonstrate Redis hash operations for structured data storage.
 */
async function demonstrateHashOperations(redis: Redis): Promise<void> {
  console.log("\n🗂️ Hash Operations:");
  console.log("=".repeat(50));

  try {
    const userKey: RedisKey = "user:1001";
    const productKey: RedisKey = "product:widget-500";

    // Single field operations (HSET/HGET)
    await redis.hset(userKey, "name", "John Doe");
    await redis.hset(userKey, "email", "john.doe@example.com");
    await redis.hset(userKey, "age", "30");
    await redis.hset(userKey, "department", "Engineering");
    await redis.hset(userKey, "salary", "75000");

    const userName = await redis.hget(userKey, "name");
    const userAge = await redis.hget(userKey, "age");
    console.log(`👤 User: ${userName}, Age: ${userAge}`);

    // Multiple field operations (HMGET)
    const userFields = await redis.hmget(
      userKey,
      "name",
      "email",
      "department",
      "nonexistent", // This field does not exist
    );
    console.log(
      `📋 User info: Name=${userFields[0]}, Email=${userFields[1]}, Dept=${
        userFields[2]
      }, Missing=${userFields[3] ?? "null"}`,
    );

    // Get all fields and values from a hash (HGETALL)
    const allUserData = await redis.hgetall(userKey);
    console.log(`🔍 Complete user profile:`);
    for (const [field, value] of Object.entries(allUserData)) {
      console.log(`   ${field}: ${value}`);
    }

    // Batch set multiple fields with HMSET
    await redis.hmset(productKey, {
      name: "Super Widget",
      price: "29.99",
      category: "gadgets",
      stock: "150",
      rating: "4.5",
      description: "The ultimate widget for all your needs",
    });

    // Get hash metadata (HLEN, HKEYS, HVALS)
    const fieldCount = await redis.hlen(productKey);
    const fields = await redis.hkeys(productKey);
    const values = await redis.hvals(productKey);

    console.log(`📦 Product ${productKey}:`);
    console.log(`   Fields count: ${fieldCount}`);
    console.log(`   Available fields: ${fields.join(", ")}`);
    console.log(`   Sample values: ${values.slice(0, 3).join(", ")}...`);

    // Increment numeric fields atomically (HINCRBY, HINCRBYFLOAT)
    await redis.hincrby(productKey, "stock", -5); // Sold 5 items
    await redis.hincrbyfloat(productKey, "rating", 0.1); // Slight rating increase

    const newStock = await redis.hget(productKey, "stock");
    const newRating = await redis.hget(productKey, "rating");
    console.log(`📊 After update: Stock=${newStock}, Rating=${newRating}`);

    // Check field existence (HEXISTS)
    const hasPrice = await redis.hexists(productKey, "price");
    const hasDiscount = await redis.hexists(productKey, "discount");
    console.log(
      `🔍 Field existence: price=${hasPrice}, discount=${hasDiscount}`,
    );

    // Delete specific fields from a hash (HDEL)
    const deletedCount = await redis.hdel(
      productKey,
      "description",
      "nonexistent",
    );
    console.log(`🗑️ Deleted ${deletedCount} field(s) from product`);
  } catch (error) {
    console.error(`❌ Hash operations error: ${(error as Error).message}`);
    throw error; // Re-throw to be caught by the main handler
  }
}

/**
 * Demonstrate Redis list operations for queue and stack implementations.
 */
async function demonstrateListOperations(redis: Redis): Promise<void> {
  console.log("\n📋 List Operations:");
  console.log("=".repeat(50));

  try {
    const queueKey: RedisKey = "task:queue";
    const stackKey: RedisKey = "undo:stack";
    const logKey: RedisKey = "app:logs";

    // Queue operations (FIFO - First In, First Out) using RPUSH/LPOP
    console.log("🔄 Queue Operations (FIFO):");
    await redis.rpush(queueKey, "task-1", "task-2", "task-3");
    await redis.lpush(queueKey, "urgent-task"); // Add to front

    let queueLength = await redis.llen(queueKey);
    console.log(`   Queue length: ${queueLength}`);

    // Process queue items
    const processedTasks = [];
    while ((await redis.llen(queueKey)) > 0) {
      const task = await redis.lpop(queueKey);
      if (task) {
        processedTasks.push(task);
        console.log(`   ✅ Processed: ${task}`);
      }
    }

    // Stack operations (LIFO - Last In, First Out) using LPUSH/LPOP
    console.log("\n📚 Stack Operations (LIFO):");
    await redis.lpush(stackKey, "action-1", "action-2", "action-3");

    const stackLength = await redis.llen(stackKey);
    console.log(`   Stack depth: ${stackLength}`);

    // Undo operations by popping from the stack
    const undoActions = [];
    for (let i = 0; i < 2; i++) {
      const action = await redis.lpop(stackKey);
      if (action) {
        undoActions.push(action);
        console.log(`   ↶ Undoing: ${action}`);
      }
    }

    // Log operations with rotation (capped list)
    console.log("\n📜 Log Operations:");
    const logEntries = [
      `${new Date().toISOString()} INFO: Application started`,
      `${new Date().toISOString()} INFO: User logged in`,
      `${new Date().toISOString()} WARN: High memory usage`,
      `${new Date().toISOString()} ERROR: Database timeout`,
      `${new Date().toISOString()} INFO: User logged out`,
    ];

    // Add log entries and trim the list to a max size
    for (const entry of logEntries) {
      await redis.rpush(logKey, entry);

      // Rotate logs - keep only last 3 entries
      if ((await redis.llen(logKey)) > 3) {
        const removed = await redis.lpop(logKey);
        console.log(`   🗑️ Rotated out: ${removed?.substring(0, 50)}...`);
      }
    }

    // View current logs with LRANGE
    const currentLogs = await redis.lrange(logKey, 0, -1);
    console.log(`   📝 Current logs (${currentLogs.length}):`);
    currentLogs.forEach((log, index) => {
      console.log(`     ${index + 1}. ${log.substring(20, 60)}...`);
    });

    // Range operations with LRANGE
    console.log("\n🎯 Range Operations:");
    await redis.rpush(
      "numbers",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
    );

    const firstThree = await redis.lrange("numbers", 0, 2);
    const lastThree = await redis.lrange("numbers", -3, -1);
    const middle = await redis.lrange("numbers", 3, 6);

    console.log(`   First 3: [${firstThree.join(", ")}]`);
    console.log(`   Last 3: [${lastThree.join(", ")}]`);
    console.log(`   Middle: [${middle.join(", ")}]`);

    // List modification with LSET
    await redis.lset("numbers", 0, "ONE"); // Set first element
    const modified = await redis.lindex("numbers", 0);
    console.log(`   Modified first element: ${modified}`);

    // Remove elements by value with LREM
    await redis.lrem("numbers", 1, "5"); // Remove first occurrence of "5"
    const afterRemove = await redis.lrange("numbers", 0, -1);
    console.log(`   After removing '5': [${afterRemove.join(", ")}]`);

    // Trim list to a specific range with LTRIM
    await redis.ltrim("numbers", 0, 4); // Keep only first 5 elements
    const trimmed = await redis.lrange("numbers", 0, -1);
    console.log(`   After trimming: [${trimmed.join(", ")}]`);
  } catch (error) {
    console.error(`❌ List operations error: ${(error as Error).message}`);
    throw error; // Re-throw to be caught by the main handler
  }
}

/**
 * Demonstrate Redis key management and expiration operations.
 */
async function demonstrateKeyOperations(redis: Redis): Promise<void> {
  console.log("\n🔑 Key Management Operations:");
  console.log("=".repeat(50));

  try {
    // Set up test keys with different data types
    const testKeys: Record<RedisKey, RedisValue> = {
      "config:app_name": "MyApp",
      "config:version": "1.2.3",
      "config:debug": "true",
      "cache:user:1001": JSON.stringify({ name: "Alice", role: "admin" }),
      "session:abc123": "active",
      "temp:processing": "in_progress",
    };

    // Create test keys using a loop
    for (const [key, value] of Object.entries(testKeys)) {
      await redis.set(key, value.toString());
    }

    // Check key existence with EXISTS
    console.log("🔍 Key Existence Checks:");
    const existingKeys = await redis.exists(
      "config:app_name",
      "config:version",
      "nonexistent:key",
    );
    console.log(`   Found ${existingKeys} out of 3 checked keys`);

    const hasConfig = await redis.exists("config:app_name");
    const hasSession = await redis.exists("session:abc123");
    console.log(
      `   config exists: ${hasConfig === 1}, session exists: ${
        hasSession === 1
      }`,
    );

    // Pattern matching with KEYS (use with caution in production!)
    console.log("\n🎯 Pattern Matching:");
    const configKeys = await redis.keys("config:*");
    const allTempKeys = await redis.keys("temp:*");

    console.log(`   Config keys: [${configKeys.join(", ")}]`);
    console.log(`   Temp keys: [${allTempKeys.join(", ")}]`);

    // Key expiration management with EXPIRE, EXPIREAT, and TTL
    console.log("\n⏰ Expiration Management:");

    // Set expiration in seconds
    await redis.expire("session:abc123", 3600); // 1 hour
    await redis.expire("temp:processing", 300); // 5 minutes

    // Set expiration with EXPIREAT using a Unix timestamp
    const futureTime = Math.floor(Date.now() / 1000) + 1800; // 30 minutes from now
    await redis.expireat("cache:user:1001", futureTime.toString());

    // Check TTL (Time To Live)
    const sessionTtl = await redis.ttl("session:abc123");
    const tempTtl = await redis.ttl("temp:processing");
    const cacheTtl = await redis.ttl("cache:user:1001");
    const configTtl = await redis.ttl("config:app_name"); // Should be -1 (no expiration)

    console.log(
      `   Session TTL: ${sessionTtl}s (~${
        Math.round(sessionTtl / 60)
      } minutes)`,
    );
    console.log(`   Temp TTL: ${tempTtl}s`);
    console.log(`   Cache TTL: ${cacheTtl}s`);
    console.log(`   Config TTL: ${configTtl} (persistent)`);

    // Remove expiration with PERSIST
    const persistResult = await redis.persist("temp:processing");
    console.log(
      `   Made temp key persistent: ${
        persistResult === 1 ? "success" : "failed"
      }`,
    );

    // Key type inspection with TYPE
    console.log("\n🔬 Key Type Inspection:");
    const keyTypes = new Map<RedisKey, string>();
    for (const key of Object.keys(testKeys)) {
      const type = await redis.type(key);
      keyTypes.set(key, type);
    }

    for (const [key, type] of keyTypes) {
      console.log(`   ${key}: ${type}`);
    }

    // Database-level operations
    console.log("\n💾 Database Operations:");

    // Get database size with DBSIZE
    const dbSize = await redis.dbsize();
    console.log(`   Current database contains ${dbSize} keys`);

    // Get a random key with RANDOMKEY
    const randomKey = await redis.randomkey();
    if (randomKey) {
      const randomValue = await redis.get(randomKey);
      console.log(
        `   Random key sample: ${randomKey} = ${
          randomValue?.substring(0, 30)
        }...`,
      );
    }

    // Key renaming with RENAME and RENAMENX
    console.log("\n✏️ Key Renaming:");
    const oldKey: RedisKey = "temp:processing";
    const newKey: RedisKey = "task:processing";

    const keyExists = await redis.exists(oldKey);
    if (keyExists) {
      await redis.rename(oldKey, newKey);
      console.log(`   Renamed: ${oldKey} → ${newKey}`);

      // Verify rename operation
      const oldExists = await redis.exists(oldKey);
      const newExists = await redis.exists(newKey);
      console.log(
        `   Verification: old=${oldExists === 1}, new=${newExists === 1}`,
      );
    }

    // Safe rename (only if new key doesn't exist)
    const safeRename = await redis.renamenx(
      "config:debug",
      "config:debug_mode",
    );
    console.log(
      `   Safe rename result: ${
        safeRename === 1 ? "success" : "target exists"
      }`,
    );

    // Key deletion with DEL
    console.log("\n🗑️ Key Deletion:");
    const deletedCount = await redis.del(
      "config:version",
      "cache:user:1001",
      "nonexistent:key",
    );
    console.log(`   Deleted ${deletedCount} keys`);

    // Verify remaining keys after deletion
    const remainingKeys = await redis.keys("*");
    console.log(
      `   Remaining test keys: ${
        remainingKeys.filter((k) =>
          k.startsWith("config:") || k.startsWith("session:") ||
          k.startsWith("task:")
        ).length
      }`,
    );
  } catch (error) {
    console.error(`❌ Key operations error: ${(error as Error).message}`);
    throw error; // Re-throw to be caught by the main handler
  }
}

/**
 * Enhanced error handling with proper error type discrimination.
 * Provides user-friendly messages for different error scenarios.
 */
async function handleError(error: unknown): Promise<void> {
  console.error("\n❌ An error occurred:");
  console.error("=".repeat(50));

  if (error instanceof ConnectionClosedError) {
    console.error(
      "🔌 Connection Error: The connection was closed unexpectedly.",
    );
    console.error(
      "   • This usually indicates network issues or a Redis server restart.",
    );
    console.error(
      "   • Consider implementing automatic reconnection logic for robust applications.",
    );
  } else if (error instanceof ErrorReplyError) {
    console.error(
      "⚠️ Redis Command Error: The server returned an error reply.",
    );
    console.error(`   • Message: ${error.message}`);
    console.error(
      "   • This indicates an invalid command, incorrect arguments, or permission issues.",
    );
  } else if (error instanceof Error) {
    console.error("🚨 Unexpected Error: An unexpected error was caught.");
    console.error(`   • Type: ${error.constructor.name}`);
    console.error(`   • Message: ${error.message}`);
    console.error(
      "   • This may indicate a bug in the client application or a network problem.",
    );

    // Log stack trace for debugging
    if (error.stack) {
      console.error("📋 Stack trace (first 5 lines):");
      console.error(
        error.stack.split("\n").slice(0, 5).map((line) => `   ${line}`).join(
          "\n",
        ),
      );
    }
  } else {
    console.error("🤷 Unknown Error: A non-Error object was thrown.");
    console.error(`   • Received: ${JSON.stringify(error)}`);
  }
}

/**
 * Comprehensive cleanup function to remove test data and close the connection.
 */
async function cleanup(redis: Redis | null): Promise<void> {
  console.log("\n🧹 Performing cleanup...");
  console.log("=".repeat(50));

  if (!redis) {
    console.log("ℹ️ No Redis connection to clean up.");
    return;
  }

  try {
    // Only perform cleanup if the connection is active
    if (redis.isConnected && !redis.isClosed) {
      console.log("🗑️ Cleaning up test data...");

      // A set of patterns to find all keys created during the example
      const testKeyPatterns = new Set([
        "app:*",
        "session:*",
        "metrics:*",
        "inventory:*",
        "config:*",
        "user:*",
        "product:*",
        "task:*",
        "undo:*",
        "log:*",
        "cache:*",
        "temp:*",
        "numbers",
      ]);

      let totalDeleted = 0;
      for (const pattern of testKeyPatterns) {
        try {
          const keys = await redis.keys(pattern);
          if (keys.length > 0) {
            const deleted = await redis.del(...keys);
            totalDeleted += deleted;
            console.log(`   • Deleted ${deleted} keys matching "${pattern}"`);
          }
        } catch (error) {
          console.warn(
            `   ⚠️ Failed to clean pattern "${pattern}": ${
              (error as Error).message
            }`,
          );
        }
      }

      console.log(`✅ Cleanup complete: ${totalDeleted} total keys removed.`);

      // Verify that no test keys remain
      const remainingKeys = await redis.keys("*");
      const testKeysLeft = remainingKeys.filter((key) =>
        [...testKeyPatterns].some((pattern) =>
          key.match(new RegExp(pattern.replace("*", ".*")))
        )
      );

      if (testKeysLeft.length > 0) {
        console.warn(
          `⚠️ Warning: ${testKeysLeft.length} test keys may still remain: ${
            testKeysLeft.join(", ")
          }`,
        );
      }
    }

    // Always close the connection
    console.log("🔌 Closing Redis connection...");
    redis.close();

    // Verify connection is closed
    console.log(
      `✅ Connection closed: Connected=${redis.isConnected}, Closed=${redis.isClosed}`,
    );
  } catch (error) {
    console.error(`❌ Cleanup error: ${(error as Error).message}`);
    // Force close the connection if cleanup fails, ignoring potential errors
    if (!redis.isClosed) {
      try {
        redis.close();
      } catch {
        // Ignore errors during force close
      }
    }
  }

  console.log("👋 Basic Redis example finished.");
}

/**
 * Performance monitoring utility to wrap and measure async operations.
 */
function measurePerformance<T>(
  operation: () => Promise<T>,
  operationName: string,
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const start = performance.now();
    try {
      const result = await operation();
      const duration = performance.now() - start;
      console.log(`⏱️ ${operationName}: ${duration.toFixed(2)}ms`);
      resolve(result);
    } catch (error) {
      const duration = performance.now() - start;
      console.log(`❌ ${operationName} failed after ${duration.toFixed(2)}ms`);
      reject(error);
    }
  });
}

/**
 * Setup graceful shutdown handlers for SIGINT and SIGTERM.
 * Ensures the application can exit cleanly when interrupted.
 */
function setupGracefulShutdown(): void {
  const signals: Deno.Signal[] = ["SIGINT", "SIGTERM"];

  for (const signal of signals) {
    try {
      Deno.addSignalListener(signal, () => {
        console.log(`\n⚠️ Received ${signal}, shutting down gracefully...`);
        Deno.exit(0);
      });
    } catch (error) {
      // Signal handling might not be supported on all platforms (e.g., Deno Deploy)
      console.warn(
        `Warning: Could not set up ${signal} handler: ${
          (error as Error).message
        }`,
      );
    }
  }
}

/**
 * Main execution block.
 * This ensures the script runs only when executed directly.
 */
async function main(): Promise<void> {
  setupGracefulShutdown();

  try {
    await basicExample();
    Deno.exit(0);
  } catch (error) {
    // Errors from basicExample are already handled, but this catches any other potential issues.
    await handleError(error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
