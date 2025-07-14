import { connect, Redis } from "../mod.ts";

// Test Redis connection configuration
export const TEST_REDIS_CONFIG = {
  hostname: Deno.env.get("REDIS_HOST") || "127.0.0.1",
  port: parseInt(Deno.env.get("REDIS_PORT") || "6379"),
  password: Deno.env.get("REDIS_PASSWORD"),
};

// Alternative Redis configurations for testing
export const TEST_REDIS_AUTH_CONFIG = {
  hostname: Deno.env.get("REDIS_HOST") || "127.0.0.1",
  port: parseInt(Deno.env.get("REDIS_AUTH_PORT") || "6380"),
  password: Deno.env.get("REDIS_AUTH_PASSWORD") || "testpass123",
};

export const TEST_REDIS_CONFIG_PORT = {
  hostname: Deno.env.get("REDIS_HOST") || "127.0.0.1",
  port: parseInt(Deno.env.get("REDIS_CONFIG_PORT") || "6381"),
  password: Deno.env.get("REDIS_PASSWORD"),
};

// Check if Docker Redis is available
export async function isDockerRedisAvailable(): Promise<boolean> {
  try {
    const redis = await connect({
      ...TEST_REDIS_CONFIG,
      maxRetryCount: 1, // Fail fast
    });
    await redis.ping();
    redis.close();
    return true;
  } catch {
    return false;
  }
}

// Create a test Redis connection
export async function createTestRedis(): Promise<Redis> {
  try {
    const redis = await connect(TEST_REDIS_CONFIG);
    // Test connection
    await redis.ping();
    return redis;
  } catch (error) {
    console.error("Failed to connect to Redis for testing:", error);
    console.log("Make sure Redis is running at", TEST_REDIS_CONFIG);
    throw error;
  }
}

// Clean up test keys
export async function cleanupTestKeys(
  redis: Redis,
  pattern = "test:*",
): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.warn("Failed to cleanup test keys:", error);
  }
}

// Generate random test key
export function randomTestKey(prefix = "test"): string {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).substring(7)}`;
}

// Wait for a condition to be true
export async function waitFor(
  condition: () => Promise<boolean> | boolean,
  timeout = 5000,
  interval = 100,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Condition not met within ${timeout}ms`);
}
