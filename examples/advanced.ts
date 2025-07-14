/**
 * Advanced Redis Operations Example
 *
 * This comprehensive example demonstrates advanced Redis features including:
 * - Redis transactions (MULTI/EXEC) with atomic operations
 * - Optimistic locking with WATCH for safe concurrent operations
 * - Advanced connection management and pooling strategies
 * - Complex data structures (Sorted Sets, HyperLogLog, Sets)
 * - Error handling and recovery patterns
 * - Performance monitoring and health checks
 * - Real-world use cases and patterns
 *
 * @example
 * ```bash
 * # Run this example
 * deno run -A examples/advanced.ts
 * ```
 */

import {
  connect,
  createLazyClient,
  parseURL,
  type Redis,
  type RedisConnectOptions,
} from "../mod.ts";

/**
 * Enhanced configuration interface with connection pooling support
 */
interface AdvancedRedisConfig extends RedisConnectOptions {
  hostname: string;
  port: number;
  password?: string;
  db?: number;
  name?: string;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Configuration for different connection scenarios
 */
const REDIS_CONFIGS = {
  primary: {
    hostname: Deno.env.get("REDIS_HOST") ?? "127.0.0.1",
    port: parseInt(Deno.env.get("REDIS_PORT") ?? "6379"),
    password: Deno.env.get("REDIS_PASSWORD"),
    db: parseInt(Deno.env.get("REDIS_DB") ?? "0"),
    name: "primary-connection",
    maxRetries: 3,
    retryDelay: 1000,
  } as AdvancedRedisConfig,

  lazy: {
    hostname: Deno.env.get("REDIS_HOST") ?? "127.0.0.1",
    port: parseInt(Deno.env.get("REDIS_PORT") ?? "6379"),
    password: Deno.env.get("REDIS_PASSWORD"),
    db: parseInt(Deno.env.get("REDIS_DB") ?? "0"),
    name: "lazy-connection",
  } as AdvancedRedisConfig,
} as const;

/**
 * Main function demonstrating advanced Redis operations
 */
async function advancedExample(): Promise<void> {
  console.log("🚀 Starting Advanced Redis Operations Example");
  console.log("=".repeat(60));

  const connections: Redis[] = [];

  try {
    // Demonstrate various connection patterns
    const { redis1, redis2, redis3 } = await setupConnections();
    connections.push(redis1, redis2, redis3);

    // Core advanced operations
    await demonstrateTransactions(redis1);
    await demonstrateOptimisticLocking(redis1, redis2, redis3);
    await demonstrateAdvancedDataStructures(redis1);
    await demonstrateConnectionPooling();
    await demonstrateErrorHandlingAndRecovery(redis1);
    await performHealthChecks(redis1, redis2, redis3);

    console.log("\n🎉 All advanced operations completed successfully!");
  } catch (error) {
    await handleAdvancedError(error);
  } finally {
    await cleanupConnections(connections);
  }
}

/**
 * Centralized error handler for the advanced example
 */
async function handleAdvancedError(error: unknown): Promise<void> {
  console.error("\n💥 An unexpected error occurred in the advanced example:");
  if (error instanceof Error) {
    console.error(`   Message: ${error.message}`);
    if (error.stack) {
      console.error(`   Stack: ${error.stack.split("\n").slice(1).join("\n")}`);
    }
  } else {
    console.error(`   Error: ${JSON.stringify(error)}`);
  }
  // In a real application, you might have more sophisticated cleanup
  // For this example, we just log and exit.
}

/**
 * Setup different types of Redis connections to demonstrate connection patterns
 */
async function setupConnections(): Promise<
  { redis1: Redis; redis2: Redis; redis3: Redis }
> {
  console.log("\n🔌 Advanced Connection Management:");
  console.log("-".repeat(40));

  // Standard eager connection
  console.log("📡 Establishing primary connection...");
  const redis1 = await connectWithRetry(REDIS_CONFIGS.primary);
  console.log(
    `✅ Primary connection: Connected=${redis1.isConnected}, Name=${REDIS_CONFIGS.primary.name}`,
  );

  // Lazy connection (connects only when first command is issued)
  console.log("🔄 Creating lazy connection...");
  const redis2 = createLazyClient(REDIS_CONFIGS.lazy);
  console.log(
    `⏳ Lazy connection (before use): Connected=${redis2.isConnected}`,
  );

  // Trigger lazy connection
  const pingResult = await redis2.ping();
  console.log(
    `🔄 Lazy connection (after ping '${pingResult}'): Connected=${redis2.isConnected}`,
  );

  // URL-based connection demonstrating different configuration methods
  console.log("🌐 Creating URL-based connection...");
  const redisUrl = parseURL(
    `redis://${REDIS_CONFIGS.primary.hostname}:${REDIS_CONFIGS.primary.port}`,
  );
  const redis3 = await connect({
    ...redisUrl,
    name: "url-based-connection",
  });
  console.log(`✅ URL-based connection: Connected=${redis3.isConnected}`);

  // Test all connections
  const connectionTests = await Promise.all([
    testConnection(redis1, "Primary"),
    testConnection(redis2, "Lazy"),
    testConnection(redis3, "URL-based"),
  ]);

  console.log(
    `🔍 Connection test results: ${
      connectionTests.filter(Boolean).length
    }/3 passed`,
  );

  return { redis1, redis2, redis3 };
}

/**
 * Enhanced connection function with retry logic and exponential backoff
 */
async function connectWithRetry(config: AdvancedRedisConfig): Promise<Redis> {
  const maxRetries = config.maxRetries ?? 3;
  const baseDelay = config.retryDelay ?? 1000;
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `   🔄 Attempt ${attempt}/${maxRetries} for ${config.name}...`,
      );

      const redis = await connect(config);

      // Verify connection immediately
      await redis.ping();

      console.log(`   ✅ Successfully connected on attempt ${attempt}`);
      return redis;
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `   ⚠️ Attempt ${attempt} failed: ${(error as Error).message}`,
      );

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`   ⏳ Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `Failed to connect ${config.name} after ${maxRetries} attempts. Last error: ${
      lastError!.message
    }`,
  );
}

/**
 * Test connection health and performance
 */
async function testConnection(redis: Redis, name: string): Promise<boolean> {
  try {
    const start = performance.now();
    const pong = await redis.ping();
    const latency = performance.now() - start;

    console.log(`   💓 ${name}: ${pong} (${latency.toFixed(2)}ms latency)`);
    return true;
  } catch (error) {
    console.error(`   💔 ${name}: FAILED (${(error as Error).message})`);
    return false;
  }
}
/**
 * Demonstrate Redis transactions for atomic operations
 */
async function demonstrateTransactions(redis: Redis): Promise<void> {
  console.log("\n💳 Redis Transactions (MULTI/EXEC):");
  console.log("-".repeat(40));

  try {
    // Setup initial account balances
    await redis.mset({
      "account:alice": "1000",
      "account:bob": "500",
      "account:charlie": "750",
    });

    console.log("💰 Initial account balances:");
    const initialBalances = await redis.mget(
      "account:alice",
      "account:bob",
      "account:charlie",
    );
    console.log(
      `   Alice: $${initialBalances[0]}, Bob: $${
        initialBalances[1]
      }, Charlie: $${initialBalances[2]}`,
    );

    // Transaction 1: Simple money transfer
    console.log("\n💸 Executing atomic transfer: Alice → Bob ($200)");

    await redis.multi();
    await redis.decrby("account:alice", 200);
    await redis.incrby("account:bob", 200);
    await redis.set(
      "last_transfer",
      JSON.stringify({
        from: "alice",
        to: "bob",
        amount: 200,
        timestamp: new Date().toISOString(),
      }),
    );
    await redis.sadd("transfer_log", `${Date.now()}:alice:bob:200`);

    const transferResults = await redis.exec();
    console.log(
      `   ✅ Transaction executed with ${transferResults?.length} operations`,
    );

    // Verify transfer
    const postTransferBalances = await redis.mget(
      "account:alice",
      "account:bob",
    );
    console.log(
      `   💰 After transfer: Alice: $${postTransferBalances[0]}, Bob: $${
        postTransferBalances[1]
      }`,
    );

    // Transaction 2: Complex business logic with validation
    console.log("\n🏦 Complex transaction with business logic:");

    const transferAmount = 300;
    const fee = 5;
    const minBalance = 100;

    await redis.multi();

    // Check if Alice has sufficient balance (this is just for demo - real validation should be before MULTI)
    await redis.get("account:alice");
    await redis.decrby("account:alice", transferAmount + fee);
    await redis.incrby("account:charlie", transferAmount);
    await redis.incrby("account:bank_fees", fee);
    await redis.incr("transfer_count");
    await redis.zadd(
      "transfer_history",
      Date.now(),
      `alice:charlie:${transferAmount}`,
    );

    const complexResults = await redis.exec();

    if (
      complexResults &&
      complexResults.every((result) => !(result instanceof Error))
    ) {
      console.log("   ✅ Complex transaction succeeded");

      const finalBalances = await redis.mget(
        "account:alice",
        "account:charlie",
        "account:bank_fees",
      );
      const transferCount = await redis.get("transfer_count");

      console.log(
        `   💰 Final balances: Alice: $${finalBalances[0]}, Charlie: $${
          finalBalances[1]
        }`,
      );
      console.log(
        `   💼 Bank fees collected: $${
          finalBalances[2]
        }, Total transfers: ${transferCount}`,
      );
    } else {
      console.log("   ❌ Complex transaction failed");
    }

    // Transaction 3: Conditional transaction with DISCARD
    console.log("\n🚫 Demonstrating transaction cancellation:");

    await redis.multi();
    await redis.set("temp:key1", "value1");
    await redis.set("temp:key2", "value2");
    await redis.incr("temp:counter");

    // Simulate condition that requires cancellation
    const shouldCancel = true;

    if (shouldCancel) {
      await redis.discard();
      console.log("   🚫 Transaction discarded - no operations executed");

      const tempExists = await redis.exists("temp:key1", "temp:key2");
      console.log(
        `   🔍 Verification: temp keys exist = ${tempExists} (should be 0)`,
      );
    }
  } catch (error) {
    console.error(`❌ Transaction error: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Demonstrate optimistic locking with WATCH for safe concurrent operations
 */
async function demonstrateOptimisticLocking(
  redis1: Redis,
  redis2: Redis,
  redis3: Redis,
): Promise<void> {
  console.log("\n👀 Optimistic Locking with WATCH:");
  console.log("-".repeat(40));

  // Helper to distribute connections for concurrent tasks
  const connections = [redis1, redis2, redis3];
  let connIndex = 0;
  const getDedicatedConnection = () => {
    const conn = connections[connIndex];
    connIndex = (connIndex + 1) % connections.length;
    return conn;
  };

  try {
    const inventoryKey = "inventory:premium_widget";
    const ordersKey = "orders:pending";
    const initialStock = 15;

    // Setup inventory
    await redis1.set(inventoryKey, initialStock.toString());
    await redis1.del(ordersKey); // Clear any existing orders

    console.log(`📦 Initial stock: ${initialStock} premium widgets`);

    /**
     * Simulate concurrent order processing with optimistic locking
     */
    const processOrder = async (
      orderId: string,
      quantity: number,
      redis: Redis,
      customerName: string,
    ): Promise<{ success: boolean; reason?: string }> => {
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(
            `   🛒 ${customerName} (${orderId}): Processing order for ${quantity} widgets (attempt ${attempt})`,
          );

          // Ensure we're not in a transaction state from previous operations
          try {
            await redis.discard();
          } catch {
            // Ignore errors if not in transaction
          }

          // Clear any existing WATCH state
          try {
            await redis.unwatch();
          } catch {
            // Ignore errors if no keys being watched
          }

          // Watch the inventory key for changes
          await redis.watch(inventoryKey);

          // Check current stock (this read is protected by WATCH)
          const currentStockStr = await redis.get(inventoryKey);
          const currentStock = parseInt(currentStockStr || "0");

          console.log(
            `   📊 ${customerName}: Current stock check = ${currentStock} available`,
          );

          // Business logic: verify sufficient stock
          if (currentStock < quantity) {
            await redis.unwatch();
            return {
              success: false,
              reason:
                `Insufficient stock (need ${quantity}, have ${currentStock})`,
            };
          }

          // Add artificial delay to increase chance of conflicts
          await new Promise((resolve) =>
            setTimeout(resolve, 50 + Math.random() * 100)
          );

          // Start transaction
          await redis.multi();

          // Atomic operations
          await redis.decrby(inventoryKey, quantity);
          await redis.lpush(
            ordersKey,
            JSON.stringify({
              orderId,
              customerName,
              quantity,
              timestamp: new Date().toISOString(),
              processingTime: Date.now(),
            }),
          );
          await redis.incrby("stats:orders_processed", 1);
          await redis.hincrby("stats:customer_orders", customerName, 1);

          // Execute transaction
          const result = await redis.exec();

          if (
            result && result.length > 0 &&
            !result.some((r) => r instanceof Error)
          ) {
            console.log(
              `   ✅ ${customerName}: Order ${orderId} successful on attempt ${attempt}`,
            );
            return { success: true };
          } else {
            console.log(
              `   🔄 ${customerName}: Transaction aborted (stock changed), retrying...`,
            );

            if (attempt === maxRetries) {
              return {
                success: false,
                reason:
                  `Transaction failed after ${maxRetries} attempts (high contention)`,
              };
            }

            // Brief delay before retry with exponential backoff
            const delay = 20 + Math.random() * 50 * attempt;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        } catch (error) {
          console.log(
            `   ❌ ${customerName}: Error on attempt ${attempt} - ${
              (error as Error).message
            }`,
          );

          // Ensure we clean up transaction state on error
          try {
            await redis.discard();
          } catch {
            // Ignore cleanup errors
          }

          if (attempt === maxRetries) {
            return {
              success: false,
              reason: `Error: ${(error as Error).message}`,
            };
          }

          // Exponential backoff on retry
          const delay = 50 * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      return { success: false, reason: "Unexpected failure" };
    };

    // Simulate concurrent orders from multiple customers
    console.log("\n🏃 Simulating concurrent order processing:");

    const orderPromises = [
      processOrder("ORD-001", 5, getDedicatedConnection(), "Alice Johnson"),
      processOrder("ORD-002", 4, getDedicatedConnection(), "Bob Smith"),
      processOrder("ORD-003", 8, getDedicatedConnection(), "Carol Williams"),
      processOrder("ORD-004", 3, getDedicatedConnection(), "David Brown"),
      processOrder("ORD-005", 2, getDedicatedConnection(), "Eve Davis"),
    ];

    const orderResults = await Promise.all(orderPromises);

    // Analyze results
    console.log("\n📊 Order Processing Results:");
    const successful = orderResults.filter((r) => r.success).length;
    const failed = orderResults.length - successful;

    console.log(`   ✅ Successful orders: ${successful}`);
    console.log(`   ❌ Failed orders: ${failed}`);

    orderResults.forEach((result, index) => {
      const orderId = `ORD-${String(index + 1).padStart(3, "0")}`;
      if (result.success) {
        console.log(`   🎉 ${orderId}: SUCCESS`);
      } else {
        console.log(`   🚫 ${orderId}: FAILED - ${result.reason}`);
      }
    });

    // Final inventory state
    const finalStock = await redis1.get(inventoryKey);
    const pendingOrders = await redis1.llen(ordersKey);
    const totalOrders = await redis1.get("stats:orders_processed") || "0";

    console.log("\n📈 Final Inventory State:");
    console.log(`   📦 Remaining stock: ${finalStock} widgets`);
    console.log(`   📋 Pending orders: ${pendingOrders}`);
    console.log(`   📊 Total processed: ${totalOrders} orders`);

    // Verify data consistency
    const ordersList = await redis1.lrange(ordersKey, 0, -1);
    const totalSold = ordersList.reduce((sum, orderStr) => {
      const order = JSON.parse(orderStr);
      return sum + order.quantity;
    }, 0);

    const expectedStock = initialStock - totalSold;
    const actualStock = parseInt(finalStock || "0");

    console.log(`🔍 Data Consistency Check:`);
    console.log(
      `   Expected stock: ${expectedStock} (${initialStock} - ${totalSold})`,
    );
    console.log(`   Actual stock: ${actualStock}`);
    console.log(
      `   Consistency: ${
        expectedStock === actualStock ? "✅ PASSED" : "❌ FAILED"
      }`,
    );

    // Customer statistics
    const customerStatsArray = await redis1.hgetall("stats:customer_orders");
    if (customerStatsArray.length > 0) {
      console.log(`📊 Customer Order Statistics:`);
      // hgetall returns [field1, value1, field2, value2, ...]
      for (let i = 0; i < customerStatsArray.length; i += 2) {
        const customer = customerStatsArray[i];
        const orders = customerStatsArray[i + 1];
        console.log(`   👤 ${customer}: ${orders} orders`);
      }
    }
  } catch (error) {
    console.error(`❌ Optimistic locking error: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Demonstrate advanced Redis data structures for complex use cases
 */
async function demonstrateAdvancedDataStructures(redis: Redis): Promise<void> {
  console.log("\n🗂️ Advanced Data Structures:");
  console.log("-".repeat(40));

  try {
    // === Sorted Sets for Leaderboards and Rankings ===
    console.log("🏆 Sorted Sets - Gaming Leaderboard:");

    const leaderboardKey = "game:leaderboard:weekly";

    // Add players with scores
    const players = [
      { name: "ProGamer99", score: 2450 },
      { name: "ElitePlayer", score: 2100 },
      { name: "SkillMaster", score: 2780 },
      { name: "GameChampion", score: 2300 },
      { name: "VictorySeeker", score: 2650 },
      { name: "TopScorer", score: 2890 },
      { name: "LegendPlayer", score: 2150 },
      { name: "AceGamer", score: 2520 },
    ];

    // Add players with scores (use individual ZADD for better reliability)
    for (const player of players) {
      await redis.zadd(leaderboardKey, player.score, player.name);
    }

    // Verify all players were added
    const totalPlayers = await redis.zcard(leaderboardKey);
    console.log(`   📊 Total players added: ${totalPlayers}`);

    // Get top 5 players with scores
    const topPlayers = await redis.zrevrange(leaderboardKey, 0, 4, {
      withScore: true,
    });
    console.log("   🥇 Top 5 Players:");
    for (let i = 0; i < topPlayers.length; i += 2) {
      const rank = (i / 2) + 1;
      const player = topPlayers[i];
      const score = topPlayers[i + 1];
      console.log(`      ${rank}. ${player}: ${score} points`);
    }

    // Get specific player information
    const targetPlayer = "ProGamer99";
    const playerScore = await redis.zscore(leaderboardKey, targetPlayer);
    const playerRank = await redis.zrevrank(leaderboardKey, targetPlayer);

    console.log(
      `   📊 ${targetPlayer}: Score=${playerScore}, Rank=#${
        (playerRank || 0) + 1
      }`,
    );

    // Get players in score range
    const elitePlayers = await redis.zrevrangebyscore(
      leaderboardKey,
      3000,
      2500,
      { withScore: true },
    );
    console.log(
      `   ⭐ Elite players (2500-3000): ${elitePlayers.length / 2} players`,
    );

    // === HyperLogLog for Unique Counting ===
    console.log("\n📊 HyperLogLog - Unique Visitor Tracking:");

    const visitorCounters = {
      "analytics:unique_visitors:2024-01": "visitors_jan",
      "analytics:unique_visitors:2024-02": "visitors_feb",
      "analytics:unique_visitors:2024-03": "visitors_mar",
    };

    // Simulate visitor data for different months
    const simulateVisitors = async (
      key: string,
      visitorCount: number,
      prefix: string,
    ) => {
      const visitors = Array.from(
        { length: visitorCount },
        (_, i) => `${prefix}_user_${i + 1}`,
      );

      // Add some overlap between months
      if (prefix !== "jan") {
        visitors.push("jan_user_1", "jan_user_2", "jan_user_3");
      }

      for (const visitor of visitors) {
        await redis.pfadd(key, visitor);
      }

      return visitors.length;
    };

    await simulateVisitors("analytics:unique_visitors:2024-01", 1500, "jan");
    await simulateVisitors("analytics:unique_visitors:2024-02", 1800, "feb");
    await simulateVisitors("analytics:unique_visitors:2024-03", 2200, "mar");

    // Get monthly unique counts
    for (const [key, label] of Object.entries(visitorCounters)) {
      const uniqueCount = await redis.pfcount(key);
      console.log(`   📅 ${label}: ~${uniqueCount} unique visitors`);
    }

    // Merge counters to get quarterly total
    await redis.pfmerge(
      "analytics:unique_visitors:q1_2024",
      "analytics:unique_visitors:2024-01",
      "analytics:unique_visitors:2024-02",
      "analytics:unique_visitors:2024-03",
    );

    const quarterlyUnique = await redis.pfcount(
      "analytics:unique_visitors:q1_2024",
    );
    console.log(`   🗓️ Q1 2024 total unique visitors: ~${quarterlyUnique}`);

    // === Sets for Tag Management ===
    console.log("\n🏷️ Sets - Content Tag Management:");

    const articles = [
      { id: "article:1", tags: ["programming", "javascript", "tutorial"] },
      { id: "article:2", tags: ["programming", "python", "data-science"] },
      { id: "article:3", tags: ["javascript", "react", "frontend"] },
      { id: "article:4", tags: ["data-science", "machine-learning", "python"] },
      { id: "article:5", tags: ["tutorial", "beginner", "programming"] },
    ];

    // Store article tags in sets
    for (const article of articles) {
      await redis.sadd(`${article.id}:tags`, ...article.tags);

      // Also maintain reverse mapping - tag to articles
      for (const tag of article.tags) {
        await redis.sadd(`tag:${tag}:articles`, article.id);
      }
    }

    // Find articles with specific tags
    const programmingArticles = await redis.smembers(
      "tag:programming:articles",
    );
    const javascriptArticles = await redis.smembers("tag:javascript:articles");

    console.log(`   💻 Programming articles: ${programmingArticles.length}`);
    console.log(`   🌐 JavaScript articles: ${javascriptArticles.length}`);

    // Find articles that have both programming AND javascript tags
    const bothTags = await redis.sinter(
      "tag:programming:articles",
      "tag:javascript:articles",
    );
    console.log(`   🎯 Articles with both tags: ${bothTags.join(", ")}`);

    // Find all unique tags
    const allTags = new Set<string>();
    for (const article of articles) {
      const tags = await redis.smembers(`${article.id}:tags`);
      tags.forEach((tag) => allTags.add(tag));
    }
    console.log(
      `   🏷️ Total unique tags: ${allTags.size} (${
        Array.from(allTags).join(", ")
      })`,
    );

    // Find popular tags (appear in multiple articles)
    const tagPopularity = new Map<string, number>();
    for (const tag of allTags) {
      const articleCount = await redis.scard(`tag:${tag}:articles`);
      tagPopularity.set(tag, articleCount);
    }

    const popularTags = Array.from(tagPopularity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    console.log("   🔥 Most popular tags:");
    popularTags.forEach(([tag, count], index) => {
      console.log(`      ${index + 1}. ${tag}: ${count} articles`);
    });
  } catch (error) {
    console.error(
      `❌ Advanced data structures error: ${(error as Error).message}`,
    );
    throw error;
  }
}

/**
 * RedisConnectionPool - A simple connection pool implementation for demonstration
 *
 * This class manages a pool of Redis connections to be reused for multiple operations,
 * which is a common pattern in high-throughput applications to avoid the overhead of
 * establishing a new connection for every request.
 *
 * @example
 * ```typescript
 * const pool = new RedisConnectionPool(config, 5);
 * await pool.initialize();
 * const redis = pool.getConnection(); // Get a connection from the pool
 * await redis.set("foo", "bar");
 * await pool.closeAll();
 * ```
 */
class RedisConnectionPool {
  private connections: Redis[] = [];
  private currentIndex = 0;
  private isInitialized = false;

  constructor(private config: AdvancedRedisConfig, private size: number) {}

  /**
   * Initialize the connection pool
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error("Connection pool already initialized");
    }

    console.log(
      `🔄 Initializing connection pool with ${this.size} connections...`,
    );

    const promises = [];
    for (let i = 0; i < this.size; i++) {
      promises.push(
        connectWithRetry({ ...this.config, name: `pool-conn-${i}` }),
      );
    }
    this.connections = await Promise.all(promises);

    this.isInitialized = true;
    console.log("✅ Connection pool initialization complete");
  }

  /**
   * Get a Redis connection from the pool
   */
  getConnection(): Redis {
    if (!this.isInitialized || this.connections.length === 0) {
      throw new Error("Connection pool not initialized or is empty");
    }

    const connection = this.connections[this.currentIndex];

    // Round-robin selection for simple load balancing
    this.currentIndex = (this.currentIndex + 1) % this.connections.length;

    return connection;
  }

  /**
   * Health check for the connection pool
   */
  async healthCheck(): Promise<{ healthy: number; total: number }> {
    const healthCheckPromises = this.connections.map(async (connection) => {
      try {
        await connection.ping();
        return true;
      } catch {
        return false;
      }
    });

    const results = await Promise.all(healthCheckPromises);
    const healthyCount = results.filter(Boolean).length;

    return {
      healthy: healthyCount,
      total: this.connections.length,
    };
  }

  /**
   * Close all connections in the pool
   */
  async closeAll(): Promise<void> {
    console.log("🔌 Closing all connections in the pool...");

    const closePromises = this.connections.map(async (connection, i) => {
      try {
        await connection.close();
        console.log(`   ✅ Connection ${i + 1} closed`);
      } catch (error) {
        console.warn(
          `   ⚠️ Error closing connection ${i + 1}: ${
            (error as Error).message
          }`,
        );
      }
    });

    await Promise.all(closePromises);

    this.connections = [];
    this.currentIndex = 0;
    this.isInitialized = false;

    console.log("✅ All connections closed");
  }
}

/**
 * Demonstrate connection pooling for high-throughput applications
 */
async function demonstrateConnectionPooling(): Promise<void> {
  console.log("\n🏊 Connection Pooling Simulation:");
  console.log("-".repeat(40));

  try {
    const poolSize = 5;
    const pool = new RedisConnectionPool(REDIS_CONFIGS.primary, poolSize);

    await pool.initialize();
    console.log(`✅ Initialized connection pool with ${poolSize} connections`);

    // Simulate concurrent operations using the pool
    const operations = Array.from({ length: 15 }, (_, i) => ({
      key: `pool:operation:${i + 1}`,
      value: `result_${i + 1}`,
      operationId: i + 1,
    }));

    console.log(`🔄 Executing ${operations.length} concurrent operations...`);

    const startTime = performance.now();

    const operationPromises = operations.map(async (op) => {
      const connection = pool.getConnection();

      try {
        // Simulate different types of operations
        if (op.operationId % 3 === 0) {
          // Hash operation
          await connection.hset(
            `hash:${op.key}`,
            {
              "data": op.value,
              "timestamp": Date.now().toString(),
            },
          );
          const result = await connection.hgetall(`hash:${op.key}`);
          return {
            operationId: op.operationId,
            type: "hash",
            result: Object.keys(result).length,
          };
        } else if (op.operationId % 2 === 0) {
          // List operation
          await connection.lpush(
            `list:${op.key}`,
            op.value,
            `item_${op.operationId}`,
          );
          const length = await connection.llen(`list:${op.key}`);
          return { operationId: op.operationId, type: "list", result: length };
        } else {
          // String operation
          await connection.set(op.key, op.value);
          const retrieved = await connection.get(op.key);
          return {
            operationId: op.operationId,
            type: "string",
            result: retrieved,
          };
        }
      } catch (error) {
        return {
          operationId: op.operationId,
          type: "error",
          result: (error as Error).message,
        };
      }
    });

    const results = await Promise.all(operationPromises);
    const duration = performance.now() - startTime;

    console.log(
      `⏱️ Completed ${results.length} operations in ${duration.toFixed(2)}ms`,
    );
    console.log(
      `📊 Average time per operation: ${
        (duration / results.length).toFixed(2)
      }ms`,
    );

    // Analyze results by type
    const resultsByType = results.reduce((acc, result) => {
      acc[result.type] = (acc[result.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log("📈 Operations by type:");
    for (const [type, count] of Object.entries(resultsByType)) {
      console.log(`   ${type}: ${count} operations`);
    }

    // Test pool health
    const healthResults = await pool.healthCheck();
    console.log(
      `💓 Pool health: ${healthResults.healthy}/${healthResults.total} connections healthy`,
    );

    await pool.closeAll();
    console.log("🔌 Connection pool closed");
  } catch (error) {
    console.error(`❌ Connection pooling error: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Demonstrate comprehensive error handling and recovery patterns
 */
async function demonstrateErrorHandlingAndRecovery(
  redis: Redis,
): Promise<void> {
  console.log("\n🛡️ Error Handling and Recovery:");
  console.log("-".repeat(40));

  try {
    // Test 1: Graceful handling of null results
    console.log("🔍 Testing null value handling:");
    const nullResult = await redis.get("definitely:does:not:exist");
    console.log(
      `   Non-existent key result: ${
        nullResult === null ? "null (expected)" : nullResult
      }`,
    );

    // Test 2: Type mismatch errors
    console.log("\n⚠️ Testing type mismatch handling:");

    // Set up a string key
    await redis.set("type:test:string", "hello world");

    try {
      // Try to use list operation on string key - should fail gracefully
      await redis.lpush("type:test:string", "item");
      console.log("   ❌ Expected error but operation succeeded");
    } catch (error) {
      console.log(
        `   ✅ Correctly caught type error: ${
          (error as Error).message.substring(0, 50)
        }...`,
      );
    }

    // Test 3: Connection resilience testing
    console.log("\n🔄 Testing connection resilience:");

    const resilientOperations = async () => {
      const operations = [];

      for (let i = 0; i < 5; i++) {
        operations.push(
          performResilientOperation(
            redis,
            `resilience:test:${i}`,
            `value_${i}`,
          ),
        );
      }

      return Promise.all(operations);
    };

    const resilientResults = await resilientOperations();
    const successCount = resilientResults.filter((r) => r.success).length;
    console.log(
      `   📊 Resilient operations: ${successCount}/${resilientResults.length} succeeded`,
    );

    // Test 4: Timeout handling simulation
    console.log("\n⏰ Testing timeout scenarios:");

    const timeoutTest = async () => {
      try {
        // Set a reasonable timeout for testing
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Operation timeout")), 50);
        });

        const operationPromise = redis.ping();

        // Race between operation and timeout
        await Promise.race([operationPromise, timeoutPromise]);
        return { success: true, message: "Operation completed within timeout" };
      } catch (error) {
        return { success: false, message: (error as Error).message };
      }
    };

    const timeoutResult = await timeoutTest();
    console.log(
      `   ⏱️ Timeout test: ${
        timeoutResult.success ? "✅" : "⚠️"
      } ${timeoutResult.message}`,
    );

    // Test 5: Batch operation error handling
    console.log("\n📦 Testing batch operation error handling:");

    const batchOperations = [
      () => redis.set("batch:1", "value1"),
      () => redis.hset("batch:hash", "field", "value"),
      () => redis.get("batch:1"),
      () => redis.lpush("batch:1", "item"), // This should fail - wrong type
      () => redis.get("batch:nonexistent"),
    ];

    const batchResults = await Promise.allSettled(
      batchOperations.map((op) => op()),
    );

    console.log("   📊 Batch operation results:");
    batchResults.forEach((result, index) => {
      const status = result.status === "fulfilled" ? "✅" : "❌";
      const message = result.status === "fulfilled"
        ? `Success: ${JSON.stringify(result.value)}`
        : `Error: ${(result.reason as Error).message.substring(0, 30)}...`;
      console.log(`      Operation ${index + 1}: ${status} ${message}`);
    });
  } catch (error) {
    console.error(
      `❌ Error handling demonstration error: ${(error as Error).message}`,
    );
    throw error;
  }
}

/**
 * Perform a Redis operation with basic resilience patterns
 */
async function performResilientOperation(
  redis: Redis,
  key: string,
  value: string,
): Promise<{ success: boolean; message: string }> {
  const maxRetries = 2;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await redis.set(key, value);
      const retrieved = await redis.get(key);

      if (retrieved === value) {
        return {
          success: true,
          message: `Operation succeeded on attempt ${attempt}`,
        };
      } else {
        throw new Error("Value mismatch after set/get");
      }
    } catch (error) {
      if (attempt === maxRetries) {
        return {
          success: false,
          message: `Failed after ${maxRetries} attempts: ${
            (error as Error).message
          }`,
        };
      }

      // Brief delay before retry
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  return { success: false, message: "Unexpected failure" };
}

/**
 * Perform comprehensive health checks on multiple connections
 */
async function performHealthChecks(
  redis1: Redis,
  redis2: Redis,
  redis3: Redis,
): Promise<void> {
  console.log("\n💓 Comprehensive Health Checks:");
  console.log("-".repeat(40));

  const connections = [
    { redis: redis1, name: "Primary" },
    { redis: redis2, name: "Lazy" },
    { redis: redis3, name: "URL-based" },
  ];

  for (const { redis, name } of connections) {
    await performDetailedHealthCheck(redis, name);
  }

  // Cross-connection consistency check
  console.log("\n🔄 Cross-connection consistency check:");
  const testKey = "health:consistency:test";
  const testValue = `consistency_${Date.now()}`;

  try {
    await redis1.set(testKey, testValue);

    const results = await Promise.all([
      redis1.get(testKey),
      redis2.get(testKey),
      redis3.get(testKey),
    ]);

    const allMatch = results.every((result) => result === testValue);
    console.log(
      `   🔍 Consistency check: ${allMatch ? "✅ PASSED" : "❌ FAILED"}`,
    );

    if (!allMatch) {
      console.log(`   Values: ${JSON.stringify(results)}`);
    }
  } catch (error) {
    console.log(`   ❌ Consistency check failed: ${(error as Error).message}`);
  }
}

/**
 * Perform detailed health check on a single connection
 */
async function performDetailedHealthCheck(
  redis: Redis,
  name: string,
): Promise<void> {
  console.log(`🏥 Health check for ${name} connection:`);

  try {
    // Basic connectivity
    const start = performance.now();
    const pong = await redis.ping();
    const latency = performance.now() - start;

    console.log(`   � Ping: ${pong} (${latency.toFixed(2)}ms)`);

    // Connection state
    console.log(
      `   🔌 State: Connected=${redis.isConnected}, Closed=${redis.isClosed}`,
    );

    // Basic operation test
    const testKey = `healthcheck:${name.toLowerCase()}:${Date.now()}`;
    await redis.set(testKey, "test");
    const testResult = await redis.get(testKey);
    await redis.del(testKey);

    console.log(
      `   🧪 Basic operations: ${
        testResult === "test" ? "✅ PASSED" : "❌ FAILED"
      }`,
    );

    // Server info (if accessible)
    try {
      const info = await redis.info("server");
      const versionMatch = info.match(/redis_version:([^\r\n]+)/);
      if (versionMatch) {
        console.log(`   🔧 Redis version: ${versionMatch[1]}`);
      }
    } catch {
      console.log(`   ℹ️ Server info not accessible`);
    }
  } catch (error) {
    console.log(`   ❌ Health check failed: ${(error as Error).message}`);
  }
}

/**
 * Clean up all Redis connections
 */
async function cleanupConnections(connections: Redis[]): Promise<void> {
  console.log("\n🧹 Cleaning up connections...");
  for (const redis of connections) {
    if (redis.isConnected) {
      try {
        await redis.close();
        console.log("   ✅ Connection closed.");
      } catch (error) {
        console.warn(
          `   ⚠️ Error closing a connection: ${(error as Error).message}`,
        );
      }
    }
  }
  console.log("✅ All connections cleaned up.");
}

/**
 * Performance monitoring utility for advanced operations
 *
 * This class provides a simple way to measure and report the performance of asynchronous operations.
 * It's used throughout the example to track the duration of various Redis commands and tasks.
 */
class PerformanceMonitor {
  private static measurements: Map<string, number[]> = new Map();

  static async measure<T>(
    operation: () => Promise<T>,
    operationName: string,
    logResult = true,
  ): Promise<T> {
    const start = performance.now();

    try {
      const result = await operation();
      const duration = performance.now() - start;

      // Store measurement
      if (!this.measurements.has(operationName)) {
        this.measurements.set(operationName, []);
      }
      this.measurements.get(operationName)!.push(duration);

      if (logResult) {
        console.log(`⏱️ ${operationName}: ${duration.toFixed(2)}ms`);
      }

      return result;
    } catch (error) {
      const duration = performance.now() - start;

      if (logResult) {
        console.log(
          `❌ ${operationName}: Failed after ${duration.toFixed(2)}ms`,
        );
      }

      throw error;
    }
  }

  static getStats(
    operationName: string,
  ): { count: number; avg: number; min: number; max: number } | null {
    const measurements = this.measurements.get(operationName);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    return {
      count: measurements.length,
      avg: measurements.reduce((sum, val) => sum + val, 0) /
        measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
    };
  }

  static printAllStats(): void {
    console.log("\n📊 Performance Statistics:");
    console.log("-".repeat(40));

    for (const [operation, measurements] of this.measurements.entries()) {
      const stats = this.getStats(operation);
      if (stats) {
        console.log(`   ${operation}:`);
        console.log(
          `     Count: ${stats.count}, Avg: ${stats.avg.toFixed(2)}ms`,
        );
        console.log(
          `     Min: ${stats.min.toFixed(2)}ms, Max: ${stats.max.toFixed(2)}ms`,
        );
      }
    }
  }
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(): void {
  const cleanup = () => {
    console.log("\n⚠️ Received shutdown signal, cleaning up...");
    PerformanceMonitor.printAllStats();
    Deno.exit(0);
  };

  // Handle different signals
  try {
    Deno.addSignalListener("SIGINT", cleanup);

    if (Deno.build.os !== "windows") {
      Deno.addSignalListener("SIGTERM", cleanup);
    }
  } catch (error) {
    console.warn(
      `Warning: Could not setup signal handlers: ${(error as Error).message}`,
    );
  }
}

// Run the example if this file is executed directly
if (import.meta.main) {
  setupGracefulShutdown();

  try {
    await advancedExample();
  } catch (error) {
    await handleAdvancedError(error);
    Deno.exit(1);
  }
}
