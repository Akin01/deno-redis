#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Verify deno-redis setup and Redis connectivity
 */

import { connect } from "../mod.ts";
import {
  isDockerRedisAvailable,
  TEST_REDIS_AUTH_CONFIG,
  TEST_REDIS_CONFIG,
  TEST_REDIS_CONFIG_PORT,
} from "./test_helper.ts";

async function checkRedisConnection(
  config: any,
  name: string,
): Promise<boolean> {
  try {
    console.log(`🔍 Checking ${name}...`);
    const redis = await connect(config);
    const pong = await redis.ping();
    const info = await redis.info("server");
    redis.close();

    console.log(`✅ ${name}: Connected (${pong})`);
    const version = info.match(/redis_version:([^\r\n]+)/)?.[1];
    if (version) {
      console.log(`   Redis version: ${version}`);
    }
    return true;
  } catch (error) {
    console.log(
      `❌ ${name}: Failed - ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return false;
  }
}

async function main() {
  console.log("🚀 Deno Redis Setup Verification\n");

  const results = await Promise.allSettled([
    checkRedisConnection(TEST_REDIS_CONFIG, "Basic Redis (6379)"),
    checkRedisConnection(TEST_REDIS_AUTH_CONFIG, "Auth Redis (6380)"),
    checkRedisConnection(TEST_REDIS_CONFIG_PORT, "Config Redis (6381)"),
  ]);

  const successful =
    results.filter((r) => r.status === "fulfilled" && r.value).length;
  const total = results.length;

  console.log(`\n📊 Summary: ${successful}/${total} Redis instances available`);

  if (successful === 0) {
    console.log("\n❌ No Redis instances available!");
    console.log("💡 Try running: cd docker && ./setup.sh start");
    Deno.exit(1);
  } else if (successful < total) {
    console.log(
      "\n⚠️  Some Redis instances unavailable - tests may be limited",
    );
  } else {
    console.log("\n✅ All Redis instances ready - full test suite available!");
  }

  console.log("\n🧪 Run tests with: deno task test");
  console.log("📚 View examples: deno task example:basic");
}

if (import.meta.main) {
  main();
}
