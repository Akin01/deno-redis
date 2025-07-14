/**
 * @file examples/pipeline.ts
 * @description This file provides a comprehensive demonstration of Redis pipeline capabilities using the `deno-redis` library.
 * It covers a wide range of scenarios, from basic operations to advanced patterns, performance comparisons, and error handling.
 * The examples are designed to be self-contained and executable, showcasing real-world use cases for Redis pipelines.
 *
 * To run this example, ensure you have a Redis server running on the default port and execute the following command:
 * `deno run --allow-net --allow-env examples/pipeline.ts`
 */
import { connect } from "../mod.ts";
import type { Redis } from "../mod.ts";

// Type definitions
interface UserData {
  id: number;
  name: string;
  email: string;
  score: number;
  department: string;
  joinDate: string;
}

interface PerformanceMetrics {
  operationCount: number;
  sequentialTime: number;
  pipelineTime: number;
  speedupFactor: number;
  throughputImprovement: string;
}

/**
 * Main pipeline demonstration function
 */
async function pipelineExample(): Promise<void> {
  console.log("🚀 Redis Pipeline Operations Example");
  console.log("=".repeat(60));

  const redis = await connect({
    hostname: "127.0.0.1",
    port: 6379,
  });

  try {
    await demonstrateBasicPipelineOperations(redis);
    await demonstratePerformanceComparison(redis);
    await demonstrateBatchDataProcessing(redis);
    await demonstrateErrorHandling(redis);
    await demonstrateTransactionLikeOperations(redis);
    await demonstrateAdvancedPipelinePatterns(redis);
  } catch (error) {
    await handlePipelineError(error);
  } finally {
    await cleanupPipelineExample(redis);
  }
}

/**
 * Demonstrate basic pipeline operations
 */
async function demonstrateBasicPipelineOperations(redis: Redis): Promise<void> {
  console.log("\n🔧 Basic Pipeline Operations:");
  console.log("-".repeat(40));

  try {
    // Basic pipeline with multiple operations
    const basicPipeline = redis.pipeline();

    basicPipeline.set("user:1001", "Alice");
    basicPipeline.set("user:1002", "Bob");
    basicPipeline.set("user:1003", "Charlie");
    basicPipeline.get("user:1001");
    basicPipeline.get("user:1002");
    basicPipeline.get("user:1003");

    const results = await basicPipeline.flush();
    console.log("   ✅ Basic pipeline results:", results);

    // Hash operations pipeline
    const hashPipeline = redis.pipeline();

    hashPipeline.hset("config:app", "version", "1.0.0");
    hashPipeline.hset("config:app", "debug", "true");
    hashPipeline.hset("config:app", "timeout", "30");
    hashPipeline.hgetall("config:app");

    const hashResults = await hashPipeline.flush();
    console.log(
      "   ✅ Hash pipeline results:",
      hashResults[hashResults.length - 1],
    );
  } catch (error) {
    console.error(`❌ Basic pipeline error: ${error.message}`);
    throw error;
  }
}

/**
 * Demonstrate performance comparison between sequential and pipeline operations
 */
async function demonstratePerformanceComparison(redis: Redis): Promise<void> {
  console.log("\n⚡ Performance Comparison:");
  console.log("-".repeat(40));

  try {
    const operationCounts = [10, 50, 100];
    const performanceResults: PerformanceMetrics[] = [];

    for (const operationCount of operationCounts) {
      console.log(`\n📊 Testing with ${operationCount} operations:`);

      const testKeyPrefix = `perf-test:${operationCount}`;

      // === Sequential Operations ===
      console.log(`   🐌 Sequential operations...`);
      const sequentialStart = performance.now();

      for (let i = 0; i < operationCount; i++) {
        await redis.set(
          `${testKeyPrefix}:seq:${i}`,
          JSON.stringify({
            id: i,
            value: `sequential-value-${i}`,
            timestamp: Date.now(),
            random: Math.random(),
          }),
        );
      }

      const sequentialTime = performance.now() - sequentialStart;
      console.log(`      ⏱️ Sequential time: ${sequentialTime.toFixed(2)}ms`);
      console.log(
        `      📈 Throughput: ${
          (operationCount / sequentialTime * 1000).toFixed(
            0,
          )
        } ops/sec`,
      );

      // === Pipeline Operations ===
      console.log(`   ⚡ Pipeline operations...`);
      const pipelineStart = performance.now();

      const perfPipeline = redis.pipeline();
      for (let i = 0; i < operationCount; i++) {
        perfPipeline.set(
          `${testKeyPrefix}:pipe:${i}`,
          JSON.stringify({
            id: i,
            value: `pipeline-value-${i}`,
            timestamp: Date.now(),
            random: Math.random(),
          }),
        );
      }

      const pipelineResults = await perfPipeline.flush();
      const pipelineTime = performance.now() - pipelineStart;

      console.log(`      ⏱️ Pipeline time: ${pipelineTime.toFixed(2)}ms`);
      console.log(
        `      📈 Throughput: ${
          (operationCount / pipelineTime * 1000).toFixed(0)
        } ops/sec`,
      );

      // Calculate performance metrics
      const speedup = sequentialTime / pipelineTime;
      const throughputImprovement = ((speedup - 1) * 100).toFixed(1);

      console.log(`      🚀 Speedup: ${speedup.toFixed(2)}x faster`);
      console.log(`      📊 Throughput improvement: ${throughputImprovement}%`);
      console.log(
        `      ✅ Success rate: ${
          pipelineResults.filter((r) => r === "OK").length
        }/${operationCount}`,
      );

      performanceResults.push({
        operationCount,
        sequentialTime,
        pipelineTime,
        speedupFactor: speedup,
        throughputImprovement: `${throughputImprovement}%`,
      });
    }

    // === Performance Summary ===
    console.log("\n📈 Performance Summary:");
    console.log(
      "   Operations | Sequential | Pipeline  | Speedup | Improvement",
    );
    console.log(
      "   ---------- | ---------- | --------- | ------- | -----------",
    );

    for (const metrics of performanceResults) {
      const seqTime = metrics.sequentialTime.toFixed(0).padStart(9);
      const pipeTime = metrics.pipelineTime.toFixed(0).padStart(8);
      const speedup = `${metrics.speedupFactor.toFixed(2)}x`.padStart(6);
      const improvement = metrics.throughputImprovement.padStart(10);

      console.log(
        `   ${
          metrics.operationCount.toString().padStart(9)
        } | ${seqTime}ms | ${pipeTime}ms | ${speedup} | ${improvement}`,
      );
    }
  } catch (error) {
    console.error(`❌ Performance comparison error: ${error.message}`);
    throw error;
  }
}

/**
 * Demonstrate transaction-like operations using pipelines
 */
async function demonstrateTransactionLikeOperations(
  redis: Redis,
): Promise<void> {
  try {
    // === E-commerce Order Processing ===
    console.log("🛒 E-commerce Order Processing:");

    // Setup initial state
    await redis.mset(
      "inventory:widget-pro",
      "50",
      "inventory:gadget-max",
      "30",
      "account:customer:1001",
      "500.00",
      "account:merchant:store1",
      "1000.00",
    );

    const orderDetails = {
      orderId: "ORDER-2024-001",
      customerId: "1001",
      merchantId: "store1",
      items: [
        { productId: "widget-pro", quantity: 3, price: 29.99 },
        { productId: "gadget-max", quantity: 1, price: 49.99 },
      ],
      shippingCost: 9.99,
      tax: 7.19,
    };

    const totalAmount = orderDetails.items.reduce((sum, item) =>
      sum + (item.price * item.quantity), 0) +
      orderDetails.shippingCost + orderDetails.tax;

    console.log(
      `   📦 Processing order ${orderDetails.orderId} for $${
        totalAmount.toFixed(2)
      }`,
    );

    // Execute order processing pipeline
    const orderPipeline = redis.pipeline();

    // Check and update inventory
    for (const item of orderDetails.items) {
      orderPipeline.decrby(`inventory:${item.productId}`, item.quantity);
    }

    // Financial transactions
    orderPipeline.incrbyfloat(
      `account:customer:${orderDetails.customerId}`,
      -totalAmount,
    );
    orderPipeline.incrbyfloat(
      `account:merchant:${orderDetails.merchantId}`,
      totalAmount - orderDetails.tax,
    );
    orderPipeline.incrbyfloat("account:tax_authority", orderDetails.tax);

    // Order tracking
    orderPipeline.hset(`order:${orderDetails.orderId}`, {
      customerId: orderDetails.customerId,
      merchantId: orderDetails.merchantId,
      status: "processing",
      totalAmount: totalAmount.toString(),
      items: JSON.stringify(orderDetails.items),
      createdAt: new Date().toISOString(),
    });

    // Update customer order history
    orderPipeline.lpush(
      `customer:${orderDetails.customerId}:orders`,
      orderDetails.orderId,
    );

    // Update merchant sales
    orderPipeline.lpush(
      `merchant:${orderDetails.merchantId}:sales`,
      orderDetails.orderId,
    );

    // Analytics
    orderPipeline.incr("stats:orders:total");
    orderPipeline.incrbyfloat("stats:revenue:total", totalAmount);

    // Execute the complete order
    const orderStart = performance.now();
    const orderResults = await orderPipeline.flush();
    const orderTime = performance.now() - orderStart;

    console.log(`   ⚡ Order processed in ${orderTime.toFixed(2)}ms`);

    // Verify order results
    const inventoryResults = orderResults.slice(0, orderDetails.items.length);
    const customerBalance = orderResults[orderDetails.items.length];
    const merchantBalance = orderResults[orderDetails.items.length + 1];

    console.log("   📊 Order Processing Results:");
    orderDetails.items.forEach((item, index) => {
      const newInventory = inventoryResults[index];
      console.log(
        `      📦 ${item.productId}: ${newInventory} units remaining`,
      );
    });
    console.log(`      💰 Customer balance: $${customerBalance}`);
    console.log(`      🏪 Merchant balance: $${merchantBalance}`);

    // === Banking Transfer Simulation ===
    console.log("\n🏦 Banking Transfer Simulation:");

    // Setup accounts
    await redis.mset(
      "account:bank:alice",
      "2500.00",
      "account:bank:bob",
      "1200.00",
      "account:bank:charlie",
      "800.00",
    );

    const transfers = [
      { from: "alice", to: "bob", amount: 150.00 },
      { from: "bob", to: "charlie", amount: 75.00 },
      { from: "charlie", to: "alice", amount: 25.00 },
    ];

    console.log(
      `   💸 Processing ${transfers.length} simultaneous transfers...`,
    );

    const transferPipeline = redis.pipeline();

    for (const transfer of transfers) {
      const transferId = `TXN-${Date.now()}-${
        Math.random().toString(36).substr(2, 9)
      }`;

      // Debit sender
      transferPipeline.incrbyfloat(
        `account:bank:${transfer.from}`,
        -transfer.amount,
      );

      // Credit receiver
      transferPipeline.incrbyfloat(
        `account:bank:${transfer.to}`,
        transfer.amount,
      );

      // Record transaction
      transferPipeline.hset(`transaction:${transferId}`, {
        from: transfer.from,
        to: transfer.to,
        amount: transfer.amount.toString(),
        status: "completed",
        timestamp: new Date().toISOString(),
      });

      // Add to transaction history for both parties
      transferPipeline.lpush(
        `account:bank:${transfer.from}:transactions`,
        transferId,
      );
      transferPipeline.lpush(
        `account:bank:${transfer.to}:transactions`,
        transferId,
      );

      // Update daily transfer stats
      const today = new Date().toISOString().substring(0, 10);
      transferPipeline.incr(`stats:transfers:${today}:count`);
      transferPipeline.incrbyfloat(
        `stats:transfers:${today}:volume`,
        transfer.amount,
      );
    }

    // Get final balances
    transferPipeline.get("account:bank:alice");
    transferPipeline.get("account:bank:bob");
    transferPipeline.get("account:bank:charlie");

    const transferResults = await transferPipeline.flush();

    // Extract final balances
    const finalBalances = transferResults.slice(-3);
    const accounts = ["alice", "bob", "charlie"];

    console.log("   💰 Final account balances:");
    accounts.forEach((account, index) => {
      console.log(
        `      ${account}: $${
          parseFloat(finalBalances[index] as string).toFixed(2)
        }`,
      );
    });

    // === Inventory Management ===
    console.log("\n📦 Multi-location Inventory Management:");

    const locations = ["warehouse-west", "warehouse-east", "store-downtown"];
    const products = ["laptop", "tablet", "smartphone"];

    // Setup initial inventory
    const inventorySetup = redis.pipeline();
    for (const location of locations) {
      for (const product of products) {
        const stock = Math.floor(Math.random() * 100) + 20;
        inventorySetup.set(
          `inventory:${location}:${product}`,
          stock.toString(),
        );
      }
    }
    await inventorySetup.flush();

    // Simulate inventory adjustments across locations
    const adjustments = [
      {
        location: "warehouse-west",
        product: "laptop",
        change: -5,
        reason: "sale",
      },
      {
        location: "warehouse-east",
        product: "laptop",
        change: 10,
        reason: "restock",
      },
      {
        location: "store-downtown",
        product: "tablet",
        change: -3,
        reason: "sale",
      },
      {
        location: "warehouse-west",
        product: "smartphone",
        change: -2,
        reason: "damage",
      },
      {
        location: "warehouse-east",
        product: "tablet",
        change: 15,
        reason: "transfer",
      },
    ];

    const inventoryAdjustmentPipeline = redis.pipeline();

    for (const adj of adjustments) {
      const key = `inventory:${adj.location}:${adj.product}`;

      // Update inventory
      inventoryAdjustmentPipeline.incrby(key, adj.change);

      // Log the change
      const logEntry = JSON.stringify({
        location: adj.location,
        product: adj.product,
        change: adj.change,
        reason: adj.reason,
        timestamp: new Date().toISOString(),
      });
      inventoryAdjustmentPipeline.lpush("inventory:changes:log", logEntry);

      // Update product totals across all locations
      inventoryAdjustmentPipeline.incrby(
        `inventory:total:${adj.product}`,
        adj.change,
      );

      // Track changes by reason
      inventoryAdjustmentPipeline.incrby(
        `stats:inventory:${adj.reason}`,
        Math.abs(adj.change),
      );
    }

    // Get updated totals
    for (const product of products) {
      inventoryAdjustmentPipeline.get(`inventory:total:${product}`);
    }

    inventoryAdjustmentPipeline.llen("inventory:changes:log");

    const inventoryAdjustmentResults = await inventoryAdjustmentPipeline
      .flush();

    console.log("   📊 Inventory Management Results:");
    const productTotals = inventoryAdjustmentResults.slice(-4, -1);
    const totalChanges =
      inventoryAdjustmentResults[inventoryAdjustmentResults.length - 1];

    products.forEach((product, index) => {
      console.log(`      📱 ${product}: ${productTotals[index]} total units`);
    });
    console.log(`      📝 Total inventory changes logged: ${totalChanges}`);
  } catch (error) {
    console.error(`❌ Transaction-like operations error: ${error.message}`);
    throw error;
  }
}

/**
 * Demonstrate batch data processing with real-world scenarios
 */
async function demonstrateBatchDataProcessing(redis: Redis): Promise<void> {
  console.log("\n📦 Batch Data Processing:");
  console.log("-".repeat(40));

  try {
    // === User Registration Batch Processing ===
    console.log("👥 User Registration Batch Processing:");

    const users: UserData[] = [
      {
        id: 1001,
        name: "Alice Johnson",
        email: "alice@example.com",
        score: 95,
        department: "Engineering",
        joinDate: "2024-01-15",
      },
      {
        id: 1002,
        name: "Bob Smith",
        email: "bob@example.com",
        score: 87,
        department: "Marketing",
        joinDate: "2024-01-16",
      },
      {
        id: 1003,
        name: "Carol Williams",
        email: "carol@example.com",
        score: 92,
        department: "Engineering",
        joinDate: "2024-01-17",
      },
      {
        id: 1004,
        name: "David Brown",
        email: "david@example.com",
        score: 98,
        department: "Sales",
        joinDate: "2024-01-18",
      },
      {
        id: 1005,
        name: "Eve Davis",
        email: "eve@example.com",
        score: 89,
        department: "Engineering",
        joinDate: "2024-01-19",
      },
      {
        id: 1006,
        name: "Frank Miller",
        email: "frank@example.com",
        score: 76,
        department: "Support",
        joinDate: "2024-01-20",
      },
      {
        id: 1007,
        name: "Grace Wilson",
        email: "grace@example.com",
        score: 94,
        department: "Marketing",
        joinDate: "2024-01-21",
      },
      {
        id: 1008,
        name: "Henry Taylor",
        email: "henry@example.com",
        score: 88,
        department: "Sales",
        joinDate: "2024-01-22",
      },
    ];

    console.log(`   📋 Processing ${users.length} user registrations...`);

    const userBatchPipeline = redis.pipeline();

    for (const user of users) {
      // Store complete user profile as hash
      userBatchPipeline.hset(`user:${user.id}`, {
        name: user.name,
        email: user.email,
        score: user.score.toString(),
        department: user.department,
        joinDate: user.joinDate,
        status: "active",
        lastLogin: new Date().toISOString(),
      });

      // Add to department-specific sets
      userBatchPipeline.sadd(
        `department:${user.department.toLowerCase()}:members`,
        user.id.toString(),
      );

      // Add to score-based leaderboard
      userBatchPipeline.zadd("leaderboard:global", user.score, user.name);

      // Add to email index for lookups
      userBatchPipeline.set(`email:${user.email}`, user.id.toString());

      // Track join date for analytics
      const joinMonth = user.joinDate.substring(0, 7); // YYYY-MM format
      userBatchPipeline.sadd(
        `analytics:joins:${joinMonth}`,
        user.id.toString(),
      );

      // Add to general user registry
      userBatchPipeline.sadd("users:all", user.id.toString());
    }

    // Add some aggregate operations
    userBatchPipeline.scard("users:all");
    userBatchPipeline.zcard("leaderboard:global");
    userBatchPipeline.smembers("department:engineering:members");
    userBatchPipeline.zrevrange("leaderboard:global", 0, 2, "WITHSCORES");

    console.log(
      `   ⚡ Executing batch pipeline with ${
        users.length * 6 + 4
      } operations...`,
    );
    const batchStart = performance.now();
    const batchResults = await userBatchPipeline.flush();
    const batchTime = performance.now() - batchStart;

    console.log(
      `   ✅ Batch processing completed in ${batchTime.toFixed(2)}ms`,
    );

    // Extract analytics from results
    const totalUsers = batchResults[batchResults.length - 4];
    const leaderboardSize = batchResults[batchResults.length - 3];
    const engineeringMembers =
      batchResults[batchResults.length - 2] as string[];
    const topScorers = batchResults[batchResults.length - 1] as string[];

    console.log("   📊 Processing Results:");
    console.log(`      • Total users registered: ${totalUsers}`);
    console.log(`      • Leaderboard entries: ${leaderboardSize}`);
    console.log(
      `      • Engineering team: ${engineeringMembers.length} members`,
    );
    console.log(
      `      • Top scorer: ${topScorers[0]} (${topScorers[1]} points)`,
    );

    // === Product Catalog Batch Update ===
    console.log("\n🛍️ Product Catalog Batch Update:");

    const products = [
      {
        id: "PROD001",
        name: "Wireless Headphones",
        price: 149.99,
        category: "electronics",
        stock: 45,
        rating: 4.5,
      },
      {
        id: "PROD002",
        name: "Coffee Maker",
        price: 89.99,
        category: "appliances",
        stock: 23,
        rating: 4.2,
      },
      {
        id: "PROD003",
        name: "Running Shoes",
        price: 119.99,
        category: "sports",
        stock: 67,
        rating: 4.7,
      },
      {
        id: "PROD004",
        name: "Smartphone Case",
        price: 24.99,
        category: "electronics",
        stock: 156,
        rating: 4.1,
      },
      {
        id: "PROD005",
        name: "Yoga Mat",
        price: 35.99,
        category: "sports",
        stock: 89,
        rating: 4.6,
      },
      {
        id: "PROD006",
        name: "Blender",
        price: 78.99,
        category: "appliances",
        stock: 34,
        rating: 4.3,
      },
    ];

    const productPipeline = redis.pipeline();

    for (const product of products) {
      // Store product details
      productPipeline.hset(`product:${product.id}`, {
        name: product.name,
        price: product.price.toString(),
        category: product.category,
        stock: product.stock.toString(),
        rating: product.rating.toString(),
        lastUpdated: new Date().toISOString(),
      });

      // Category indexing
      productPipeline.sadd(`category:${product.category}:products`, product.id);

      // Price range indexing
      const priceRange = product.price < 50
        ? "budget"
        : product.price < 100
        ? "mid"
        : "premium";
      productPipeline.sadd(`price:${priceRange}:products`, product.id);

      // Stock level monitoring
      if (product.stock < 50) {
        productPipeline.sadd("inventory:low_stock", product.id);
      }

      // Rating-based ranking
      productPipeline.zadd("products:by_rating", product.rating, product.id);

      // Price-based ranking (inverted for cheapest first)
      productPipeline.zadd("products:by_price", product.price, product.id);
    }

    // Category analytics
    productPipeline.scard("category:electronics:products");
    productPipeline.scard("category:appliances:products");
    productPipeline.scard("category:sports:products");
    productPipeline.scard("inventory:low_stock");
    productPipeline.zrevrange("products:by_rating", 0, 2, "WITHSCORES");

    console.log(`   📦 Updating ${products.length} products...`);
    const productBatchStart = performance.now();
    const productResults = await productPipeline.flush();
    const productBatchTime = performance.now() - productBatchStart;

    console.log(
      `   ⚡ Product update completed in ${productBatchTime.toFixed(2)}ms`,
    );

    // Extract product analytics
    const electronicsCount = productResults[productResults.length - 5];
    const appliancesCount = productResults[productResults.length - 4];
    const sportsCount = productResults[productResults.length - 3];
    const lowStockCount = productResults[productResults.length - 2];
    const topRatedProducts =
      productResults[productResults.length - 1] as string[];

    console.log("   📊 Catalog Analytics:");
    console.log(`      • Electronics: ${electronicsCount} products`);
    console.log(`      • Appliances: ${appliancesCount} products`);
    console.log(`      • Sports: ${sportsCount} products`);
    console.log(`      • Low stock alerts: ${lowStockCount} products`);
    console.log(
      `      • Highest rated: ${topRatedProducts[0]} (${
        topRatedProducts[1]
      } stars)`,
    );

    // === Log Processing Batch ===
    console.log("\n📜 Log Entry Batch Processing:");

    const logEntries = [
      {
        level: "INFO",
        message: "User login successful",
        userId: 1001,
        timestamp: new Date(),
      },
      {
        level: "WARN",
        message: "High memory usage detected",
        service: "api",
        timestamp: new Date(),
      },
      {
        level: "ERROR",
        message: "Database connection timeout",
        service: "db",
        timestamp: new Date(),
      },
      {
        level: "INFO",
        message: "Order placed successfully",
        orderId: "ORD-001",
        timestamp: new Date(),
      },
      {
        level: "DEBUG",
        message: "Cache hit for user profile",
        userId: 1002,
        timestamp: new Date(),
      },
      {
        level: "ERROR",
        message: "Payment processing failed",
        orderId: "ORD-002",
        timestamp: new Date(),
      },
      {
        level: "INFO",
        message: "Email sent successfully",
        recipient: "user@example.com",
        timestamp: new Date(),
      },
    ];

    const logPipeline = redis.pipeline();

    for (let i = 0; i < logEntries.length; i++) {
      const entry = logEntries[i];
      const logKey = `log:${Date.now()}:${i}`;

      // Store log entry
      logPipeline.hset(logKey, {
        level: entry.level,
        message: entry.message,
        timestamp: entry.timestamp.toISOString(),
        ...(entry.userId && { userId: entry.userId.toString() }),
        ...(entry.service && { service: entry.service }),
        ...(entry.orderId && { orderId: entry.orderId }),
        ...(entry.recipient && { recipient: entry.recipient }),
      });

      // Index by log level
      logPipeline.lpush(`logs:${entry.level.toLowerCase()}`, logKey);

      // Recent logs (with rotation)
      logPipeline.lpush("logs:recent", logKey);
      logPipeline.ltrim("logs:recent", 0, 99); // Keep only last 100 logs

      // Error tracking
      if (entry.level === "ERROR") {
        logPipeline.incr("stats:errors:total");
        logPipeline.incr(
          `stats:errors:${new Date().toISOString().substring(0, 10)}`,
        );
      }
    }

    // Get log statistics
    logPipeline.llen("logs:error");
    logPipeline.llen("logs:warn");
    logPipeline.llen("logs:info");
    logPipeline.get("stats:errors:total");

    console.log(`   📝 Processing ${logEntries.length} log entries...`);
    const logBatchStart = performance.now();
    const logResults = await logPipeline.flush();
    const logBatchTime = performance.now() - logBatchStart;

    console.log(
      `   ⚡ Log processing completed in ${logBatchTime.toFixed(2)}ms`,
    );

    const errorCount = logResults[logResults.length - 4];
    const warnCount = logResults[logResults.length - 3];
    const infoCount = logResults[logResults.length - 2];
    const totalErrors = logResults[logResults.length - 1];

    console.log("   📊 Log Statistics:");
    console.log(`      • Error logs: ${errorCount}`);
    console.log(`      • Warning logs: ${warnCount}`);
    console.log(`      • Info logs: ${infoCount}`);
    console.log(`      • Total errors tracked: ${totalErrors || 0}`);
  } catch (error) {
    console.error(`❌ Batch processing error: ${error.message}`);
    throw error;
  }
}
/**
 * Demonstrate error handling in pipeline operations
 */
async function demonstrateErrorHandling(redis: Redis): Promise<void> {
  console.log("\n🛡️ Pipeline Error Handling:");
  console.log("-".repeat(40));

  try {
    // === Mixed Valid/Invalid Operations ===
    console.log("⚠️ Testing pipeline with mixed valid/invalid operations:");

    const errorTestPipeline = redis.pipeline();

    // Valid operations
    errorTestPipeline.set("error-test:valid1", "success");
    errorTestPipeline.set("error-test:valid2", "also-success");

    // Invalid operation - wrong number of arguments
    errorTestPipeline.sendCommand("HSET", "incomplete"); // Missing field/value

    // More valid operations
    errorTestPipeline.set("error-test:valid3", "still-success");
    errorTestPipeline.get("error-test:valid1");

    // Another invalid operation - operation on wrong data type
    errorTestPipeline.set("error-test:string", "hello");
    errorTestPipeline.lpush("error-test:string", "item"); // This will fail

    // Final valid operation
    errorTestPipeline.get("error-test:valid2");

    console.log("   📝 Executing pipeline with 8 commands (2 will fail)...");
    const errorResults = await errorTestPipeline.flush();

    console.log("   📊 Results analysis:");
    errorResults.forEach((result, index) => {
      const commandNum = index + 1;
      if (result instanceof Error) {
        console.log(
          `      Command ${commandNum}: ❌ Error - ${
            result.message.substring(0, 50)
          }...`,
        );
      } else {
        console.log(`      Command ${commandNum}: ✅ Success - ${result}`);
      }
    });

    const successCount = errorResults.filter((r) =>
      !(r instanceof Error)
    ).length;
    const errorCount = errorResults.filter((r) => r instanceof Error).length;

    console.log(
      `   📈 Summary: ${successCount} succeeded, ${errorCount} failed`,
    );

    // === Error Recovery Pattern ===
    console.log("\n🔄 Error Recovery Pattern:");

    const safeOperations = [
      { type: "set", key: "safe:key1", value: "value1" },
      { type: "get", key: "safe:key1" },
      { type: "hset", key: "safe:hash", field: "field1", value: "hashvalue1" },
      { type: "invalid", key: "this-will-fail" }, // Intentional error
      { type: "set", key: "safe:key2", value: "value2" },
    ];

    const executeSafeOperations = async (operations: typeof safeOperations) => {
      const safePipeline = redis.pipeline();
      const operationMetadata: {
        type: string;
        key: string;
        expected: "success" | "error";
      }[] = [];

      for (const op of operations) {
        switch (op.type) {
          case "set":
            safePipeline.set(op.key, op.value);
            operationMetadata.push({
              type: "SET",
              key: op.key,
              expected: "success",
            });
            break;
          case "get":
            safePipeline.get(op.key);
            operationMetadata.push({
              type: "GET",
              key: op.key,
              expected: "success",
            });
            break;
          case "hset":
            safePipeline.hset(op.key, op.field!, op.value);
            operationMetadata.push({
              type: "HSET",
              key: op.key,
              expected: "success",
            });
            break;
          case "invalid":
            safePipeline.sendCommand("NONEXISTENT_COMMAND");
            operationMetadata.push({
              type: "INVALID",
              key: op.key,
              expected: "error",
            });
            break;
        }
      }

      const results = await safePipeline.flush();

      console.log("   🔍 Safe operation results:");
      results.forEach((result, index) => {
        const meta = operationMetadata[index];
        const isError = result instanceof Error;
        const statusIcon = (isError && meta.expected === "error") ||
            (!isError && meta.expected === "success")
          ? "✅"
          : "❌";

        const status = isError
          ? `Error: ${result.message.substring(0, 30)}...`
          : `Success: ${result}`;
        console.log(`      ${statusIcon} ${meta.type} ${meta.key}: ${status}`);
      });

      return results;
    };

    await executeSafeOperations(safeOperations);

    // === Partial Failure Handling ===
    console.log("\n⚠️ Partial Failure Handling:");

    const criticalOperations = [
      "user:critical:balance",
      "user:critical:profile",
      "user:critical:preferences",
    ];

    // Setup test data first
    const setupPipeline = redis.pipeline();
    setupPipeline.set("user:critical:balance", "1000");
    setupPipeline.hset(
      "user:critical:profile",
      "name",
      "John",
      "email",
      "john@example.com",
    );
    await setupPipeline.flush();

    // Try operations that might partially fail
    const criticalPipeline = redis.pipeline();

    // These should succeed
    criticalPipeline.get("user:critical:balance");
    criticalPipeline.hgetall("user:critical:profile");

    // This will fail - key doesn't exist as list
    criticalPipeline.lrange("user:critical:preferences", 0, -1);

    // This should succeed
    criticalPipeline.exists("user:critical:balance", "user:critical:profile");

    const criticalResults = await criticalPipeline.flush();

    console.log("   🎯 Critical operations results:");
    const balance = criticalResults[0];
    const profile = criticalResults[1];
    const preferences = criticalResults[2];
    const existence = criticalResults[3];

    console.log(
      `      💰 Balance: ${balance !== null ? `$${balance}` : "null"}`,
    );
    console.log(
      `      👤 Profile: ${typeof profile === "object" ? "loaded" : "failed"}`,
    );
    console.log(
      `      ⚙️ Preferences: ${
        preferences instanceof Error ? "error (expected)" : "loaded"
      }`,
    );
    console.log(`      ✅ Existence check: ${existence}/2 keys exist`);

    // Show how to handle partial failures
    const validResults = criticalResults.filter((r) => !(r instanceof Error));
    const errors = criticalResults.filter((r) => r instanceof Error);

    console.log(
      `   📊 Partial failure analysis: ${validResults.length} succeeded, ${errors.length} failed`,
    );
  } catch (error) {
    console.error(`❌ Error handling demonstration failed: ${error.message}`);
    throw error;
  }
}

/**
 * Demonstrate advanced pipeline patterns and optimizations
 */
async function demonstrateAdvancedPipelinePatterns(
  redis: Redis,
): Promise<void> {
  console.log("\n🚀 Advanced Pipeline Patterns:");
  console.log("-".repeat(40));

  try {
    // === Chunked Processing Pattern ===
    console.log("📦 Chunked Processing Pattern:");

    const largeDataset = Array.from({ length: 500 }, (_, i) => ({
      id: i + 1,
      data: `large-dataset-item-${i + 1}`,
      value: Math.random() * 1000,
    }));

    const chunkSize = 50;
    const chunks = [];

    for (let i = 0; i < largeDataset.length; i += chunkSize) {
      chunks.push(largeDataset.slice(i, i + chunkSize));
    }

    console.log(
      `   📊 Processing ${largeDataset.length} items in ${chunks.length} chunks of ${chunkSize}...`,
    );

    const chunkProcessingStart = performance.now();
    let totalProcessed = 0;

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      const chunkPipeline = redis.pipeline();

      for (const item of chunk) {
        chunkPipeline.hset(`dataset:item:${item.id}`, {
          data: item.data,
          value: item.value.toString(),
          chunkIndex: chunkIndex.toString(),
          processedAt: new Date().toISOString(),
        });

        // Index by value range
        const valueRange = item.value < 250
          ? "low"
          : item.value < 750
          ? "medium"
          : "high";
        chunkPipeline.sadd(`dataset:value:${valueRange}`, item.id.toString());
      }

      await chunkPipeline.flush();
      totalProcessed += chunk.length;

      if ((chunkIndex + 1) % 5 === 0) {
        console.log(
          `      Progress: ${totalProcessed}/${largeDataset.length} items processed`,
        );
      }
    }

    const chunkProcessingTime = performance.now() - chunkProcessingStart;
    console.log(
      `   ⚡ Chunked processing completed in ${
        chunkProcessingTime.toFixed(2)
      }ms`,
    );
    console.log(
      `   📈 Throughput: ${
        (largeDataset.length / chunkProcessingTime * 1000).toFixed(0)
      } items/sec`,
    );

    // Verify chunk processing results
    const verificationPipeline = redis.pipeline();
    verificationPipeline.scard("dataset:value:low");
    verificationPipeline.scard("dataset:value:medium");
    verificationPipeline.scard("dataset:value:high");

    const verificationResults = await verificationPipeline.flush();
    const [lowCount, mediumCount, highCount] = verificationResults;

    console.log(
      `   📊 Value distribution: Low=${lowCount}, Medium=${mediumCount}, High=${highCount}`,
    );

    // === Pipeline with Conditional Logic ===
    console.log("\n🔀 Pipeline with Conditional Logic:");

    const userActivities = [
      { userId: "user1", action: "login", score: 5 },
      { userId: "user2", action: "purchase", score: 20 },
      { userId: "user1", action: "share", score: 3 },
      { userId: "user3", action: "purchase", score: 25 },
      { userId: "user2", action: "review", score: 8 },
      { userId: "user3", action: "login", score: 5 },
    ];

    const activityPipeline = redis.pipeline();

    for (const activity of userActivities) {
      // Update user score
      activityPipeline.incrby(`user:${activity.userId}:score`, activity.score);

      // Track activity
      activityPipeline.lpush(
        `user:${activity.userId}:activities`,
        JSON.stringify({
          action: activity.action,
          score: activity.score,
          timestamp: new Date().toISOString(),
        }),
      );

      // Different logic based on action type
      if (activity.action === "purchase") {
        activityPipeline.sadd("users:purchasers", activity.userId);
        activityPipeline.incr(
          `stats:purchases:${new Date().toISOString().substring(0, 10)}`,
        );
      } else if (activity.action === "login") {
        activityPipeline.sadd("users:active_today", activity.userId);
      } else if (activity.action === "share") {
        activityPipeline.sadd("users:social_active", activity.userId);
      }

      // Bonus logic for high-value activities
      if (activity.score >= 20) {
        activityPipeline.sadd("users:high_value", activity.userId);
        activityPipeline.incrby(
          `user:${activity.userId}:bonus_points`,
          Math.floor(activity.score / 10),
        );
      }
    }

    // Get final analytics
    activityPipeline.smembers("users:purchasers");
    activityPipeline.scard("users:active_today");
    activityPipeline.scard("users:high_value");

    const activityResults = await activityPipeline.flush();

    const purchasers = activityResults[activityResults.length - 3] as string[];
    const activeCount = activityResults[activityResults.length - 2];
    const highValueCount = activityResults[activityResults.length - 1];

    console.log("   📊 Activity Analysis Results:");
    console.log(`      🛒 Purchasers: [${purchasers.join(", ")}]`);
    console.log(`      👥 Active users today: ${activeCount}`);
    console.log(`      💎 High-value users: ${highValueCount}`);

    // === Time-Series Data Pipeline ===
    console.log("\n📈 Time-Series Data Pipeline:");

    const generateMetrics = (timestamp: Date) => ({
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      disk: Math.random() * 100,
      network: Math.random() * 1000,
    });

    const timeSeriesPipeline = redis.pipeline();
    const baseTime = new Date();

    // Generate 24 hours of hourly metrics
    for (let hour = 0; hour < 24; hour++) {
      const timestamp = new Date(
        baseTime.getTime() - (23 - hour) * 60 * 60 * 1000,
      );
      const metrics = generateMetrics(timestamp);
      const timeKey = timestamp.toISOString().substring(0, 13); // YYYY-MM-DDTHH

      // Store raw metrics
      timeSeriesPipeline.hset(`metrics:${timeKey}`, {
        cpu: metrics.cpu.toFixed(2),
        memory: metrics.memory.toFixed(2),
        disk: metrics.disk.toFixed(2),
        network: metrics.network.toFixed(2),
        timestamp: timestamp.toISOString(),
      });

      // Rolling averages (simplified)
      timeSeriesPipeline.lpush("metrics:cpu:24h", metrics.cpu.toFixed(2));
      timeSeriesPipeline.ltrim("metrics:cpu:24h", 0, 23);

      // Alerts for high usage
      if (metrics.cpu > 80) {
        timeSeriesPipeline.sadd("alerts:cpu:high", timeKey);
      }
      if (metrics.memory > 85) {
        timeSeriesPipeline.sadd("alerts:memory:high", timeKey);
      }

      // Daily aggregates
      const dayKey = timestamp.toISOString().substring(0, 10);
      timeSeriesPipeline.incrbyfloat(
        `aggregate:${dayKey}:cpu:sum`,
        metrics.cpu,
      );
      timeSeriesPipeline.incr(`aggregate:${dayKey}:cpu:count`);
    }

    // Get aggregated data
    timeSeriesPipeline.lrange("metrics:cpu:24h", 0, -1);
    timeSeriesPipeline.scard("alerts:cpu:high");
    timeSeriesPipeline.scard("alerts:memory:high");

    const timeSeriesResults = await timeSeriesPipeline.flush();

    const cpuValues =
      timeSeriesResults[timeSeriesResults.length - 3] as string[];
    const cpuAlerts = timeSeriesResults[timeSeriesResults.length - 2];
    const memoryAlerts = timeSeriesResults[timeSeriesResults.length - 1];

    console.log("   📊 Time-Series Results:");
    console.log(`      📊 CPU samples collected: ${cpuValues.length}`);
    console.log(`      🚨 CPU high alerts: ${cpuAlerts}`);
    console.log(`      🚨 Memory high alerts: ${memoryAlerts}`);

    if (cpuValues.length > 0) {
      const avgCpu = cpuValues.reduce((sum, val) => sum + parseFloat(val), 0) /
        cpuValues.length;
      console.log(`      💻 Average CPU usage: ${avgCpu.toFixed(2)}%`);
    }
  } catch (error) {
    console.error(`❌ Advanced pipeline patterns error: ${error.message}`);
    throw error;
  }
}

/**
 * Enhanced error handling for pipeline operations
 */
async function handlePipelineError(error: unknown): Promise<void> {
  console.error("\n💥 Pipeline Example Error:");
  console.error("=".repeat(60));

  if (error instanceof Error) {
    console.error(`🚨 Error Type: ${error.constructor.name}`);
    console.error(`📝 Message: ${error.message}`);

    // Pipeline-specific error guidance
    if (error.message.includes("pipeline")) {
      console.error("⚡ Pipeline-specific error detected");
      console.error("   • Check command syntax in pipeline operations");
      console.error("   • Verify data types match expected operations");
      console.error("   • Consider using smaller pipeline batches");
    } else if (error.message.includes("memory")) {
      console.error("💾 Memory-related error detected");
      console.error("   • Reduce pipeline batch size");
      console.error("   • Process data in smaller chunks");
      console.error("   • Monitor Redis memory usage");
    } else if (error.message.includes("timeout")) {
      console.error("⏰ Timeout error detected");
      console.error("   • Reduce pipeline operation count");
      console.error("   • Optimize Redis server performance");
      console.error("   • Consider connection pool settings");
    }

    // Stack trace for debugging
    if (error.stack) {
      console.error("\n📋 Stack Trace (first 8 lines):");
      const stackLines = error.stack.split("\n").slice(0, 8);
      stackLines.forEach((line) => console.error(`   ${line}`));
    }
  } else {
    console.error(`🤷 Unknown error type: ${typeof error}`);
    console.error(`📄 Content: ${JSON.stringify(error, null, 2)}`);
  }
}

/**
 * Comprehensive cleanup for pipeline example
 */
async function cleanupPipelineExample(redis: Redis | null): Promise<void> {
  console.log("\n🧹 Pipeline Example Cleanup:");
  console.log("=".repeat(60));

  if (!redis) {
    console.log("ℹ️ No Redis connection to clean up");
    return;
  }

  try {
    if (redis.isConnected && !redis.isClosed) {
      console.log("🗑️ Cleaning up pipeline test data...");

      // Define all test key patterns used in pipeline examples
      const testKeyPatterns = [
        "user:*",
        "config:*",
        "stats:*",
        "settings:*",
        "notifications",
        "active_features",
        "error-test:*",
        "safe:*",
        "user:critical:*",
        "inventory:*",
        "account:*",
        "order:*",
        "customer:*",
        "merchant:*",
        "transaction:*",
        "dataset:*",
        "metrics:*",
        "alerts:*",
        "aggregate:*",
        "perf-test:*",
        "mixed-perf-test*",
        "logs:*",
        "leaderboard*",
        "users:*",
        "department:*",
        "email:*",
        "analytics:*",
        "product:*",
        "category:*",
        "price:*",
        "products:*",
      ];

      let totalDeleted = 0;
      const cleanupBatches = [];

      // Process cleanup in batches to avoid oversized commands
      for (let i = 0; i < testKeyPatterns.length; i += 10) {
        const batch = testKeyPatterns.slice(i, i + 10);
        cleanupBatches.push(batch);
      }

      for (const [batchIndex, patterns] of cleanupBatches.entries()) {
        try {
          const cleanupPipeline = redis.pipeline();

          for (const pattern of patterns) {
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
              // Split large deletions to avoid command size limits
              const deleteChunks = [];
              for (let i = 0; i < keys.length; i += 100) {
                deleteChunks.push(keys.slice(i, i + 100));
              }

              for (const chunk of deleteChunks) {
                cleanupPipeline.del(...chunk);
              }

              totalDeleted += keys.length;
              console.log(
                `   • Batch ${
                  batchIndex + 1
                }: Pattern "${pattern}" - ${keys.length} keys queued for deletion`,
              );
            }
          }

          if (totalDeleted > 0) {
            await cleanupPipeline.flush();
          }
        } catch (error) {
          console.warn(
            `   ⚠️ Cleanup batch ${batchIndex + 1} failed: ${error.message}`,
          );
        }
      }

      console.log(`✅ Cleanup completed: ${totalDeleted} total keys removed`);

      // Verify cleanup with a sample check
      const samplePatterns = ["user:*", "perf-test:*", "dataset:*"];
      let remainingCount = 0;

      for (const pattern of samplePatterns) {
        try {
          const remaining = await redis.keys(pattern);
          remainingCount += remaining.length;
        } catch {
          // Ignore errors during verification
        }
      }

      if (remainingCount > 0) {
        console.warn(
          `⚠️ Warning: ${remainingCount} test keys may still remain in sample patterns`,
        );
      } else {
        console.log(
          "✅ Cleanup verification: No test keys found in sample patterns",
        );
      }

      // Performance summary
      console.log("\n📊 Pipeline Example Performance Summary:");
      console.log("   • Basic pipeline operations: ✅ Completed");
      console.log("   • Performance comparisons: ✅ Completed");
      console.log("   • Batch data processing: ✅ Completed");
      console.log("   • Error handling demonstrations: ✅ Completed");
      console.log("   • Transaction-like operations: ✅ Completed");
      console.log("   • Advanced pipeline patterns: ✅ Completed");
    }

    // Close the connection
    console.log("🔌 Closing Redis connection...");
    redis.close();

    // Verify connection is closed
    console.log(
      `✅ Connection closed: Connected=${redis.isConnected}, Closed=${redis.isClosed}`,
    );
  } catch (error) {
    console.error(`❌ Cleanup error: ${error.message}`);
    // Force close the connection even if cleanup failed
    try {
      redis.close();
    } catch {
      // Ignore errors during force close
    }
  }

  console.log("👋 Pipeline Redis example completed");
}

/**
 * Performance monitoring utility for pipeline operations
 */
class PipelinePerformanceMonitor {
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
  ):
    | { count: number; avg: number; min: number; max: number; total: number }
    | null {
    const measurements = this.measurements.get(operationName);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const total = measurements.reduce((sum, val) => sum + val, 0);

    return {
      count: measurements.length,
      avg: total / measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      total,
    };
  }

  static printSummary(): void {
    console.log("\n📊 Pipeline Performance Summary:");
    console.log("-".repeat(40));

    if (this.measurements.size === 0) {
      console.log("   No performance measurements recorded");
      return;
    }

    for (const [operation, measurements] of this.measurements.entries()) {
      const stats = this.getStats(operation);
      if (stats) {
        console.log(`   ${operation}:`);
        console.log(`     Executions: ${stats.count}`);
        console.log(`     Average: ${stats.avg.toFixed(2)}ms`);
        console.log(
          `     Range: ${stats.min.toFixed(2)}ms - ${stats.max.toFixed(2)}ms`,
        );
        console.log(`     Total time: ${stats.total.toFixed(2)}ms`);
      }
    }
  }
}

/**
 * Setup graceful shutdown handlers for pipeline example
 */
function setupGracefulShutdown(): void {
  const cleanup = () => {
    console.log("\n⚠️ Received shutdown signal, cleaning up...");
    PipelinePerformanceMonitor.printSummary();
    Deno.exit(0);
  };

  // Handle different signals
  try {
    Deno.addSignalListener("SIGINT", cleanup);

    if (Deno.build.os !== "windows") {
      Deno.addSignalListener("SIGTERM", cleanup);
    }
  } catch (error) {
    console.warn(`Warning: Could not setup signal handlers: ${error.message}`);
  }
}

/**
 * Main execution function for the pipeline example.
 */
async function main(): Promise<void> {
  setupGracefulShutdown();

  try {
    await pipelineExample();
    PipelinePerformanceMonitor.printSummary();
  } catch (error) {
    await handlePipelineError(error);
    Deno.exit(1);
  }
}

// Run the example if this file is executed directly
if (import.meta.main) {
  await main();
}
