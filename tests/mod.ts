/**
 * Test runner configuration and utilities
 */

// Re-export common test utilities
export {
  assertArrayIncludes,
  assertEquals,
  assertInstanceOf,
  assertNotEquals,
  assertRejects,
} from "@std/assert";

// Test configuration
export const TEST_CONFIG = {
  redis: {
    hostname: Deno.env.get("REDIS_HOST") || "127.0.0.1",
    port: parseInt(Deno.env.get("REDIS_PORT") || "6379"),
    password: Deno.env.get("REDIS_PASSWORD"),
  },
  timeout: 10000, // 10 seconds default timeout
};

// Test skip conditions
export function skipIfNoRedis() {
  // This could be enhanced to actually check Redis availability
  const skip = Deno.env.get("SKIP_REDIS_TESTS") === "true";
  if (skip) {
    console.log("⚠️ Skipping Redis tests (SKIP_REDIS_TESTS=true)");
  }
  return skip;
}

// Test utilities
export function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Test timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// Common test cleanup utility
export async function cleanupTestStream(redis: any, streamKey: string, groupName?: string): Promise<void> {
  try {
    if (groupName) {
      await redis.xgroupDestroy(streamKey, groupName);
    }
  } catch {
    // Group might not exist, ignore error
  }
  
  try {
    await redis.del(streamKey);
  } catch {
    // Stream might not exist, ignore error
  }
}
