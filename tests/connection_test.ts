import { assertEquals, assertRejects } from "@std/assert";
import { connect, createLazyClient, parseURL } from "../mod.ts";
import { AuthenticationError, ConnectionClosedError } from "../errors.ts";
import {
  cleanupTestKeys,
  createTestRedis,
  TEST_REDIS_AUTH_CONFIG,
  TEST_REDIS_CONFIG,
} from "./test_helper.ts";

Deno.test("Connection - Basic connection", async () => {
  const redis = await createTestRedis();

  // Test connection state
  assertEquals(redis.isConnected, true);
  assertEquals(redis.isClosed, false);

  // Test basic ping
  const result = await redis.ping();
  assertEquals(result, "PONG");

  redis.close();
  assertEquals(redis.isClosed, true);
});

Deno.test("Connection - Connection with options", async () => {
  const redis = await connect({
    ...TEST_REDIS_CONFIG,
    name: "test-connection",
    maxRetryCount: 5,
  });

  // Test client name
  const clientName = await redis.clientGetName();
  assertEquals(clientName, "test-connection");

  await cleanupTestKeys(redis);
  redis.close();
});

Deno.test("Connection - URL parsing", () => {
  const options1 = parseURL("redis://localhost:6379");
  assertEquals(options1.hostname, "localhost");
  assertEquals(options1.port, 6379);
  assertEquals(options1.tls, false);

  const options2 = parseURL("rediss://user:pass@redis.example.com:6380/2");
  assertEquals(options2.hostname, "redis.example.com");
  assertEquals(options2.port, 6380);
  assertEquals(options2.tls, true);
  assertEquals(options2.username, "user");
  assertEquals(options2.password, "pass");
  assertEquals(options2.db, 2);
});

Deno.test("Connection - Lazy client", async () => {
  const redis = createLazyClient(TEST_REDIS_CONFIG);

  // Should not be connected initially
  assertEquals(redis.isConnected, false);
  assertEquals(redis.isClosed, false);

  // Connection should be established on first command
  const result = await redis.ping();
  assertEquals(result, "PONG");
  assertEquals(redis.isConnected, true);

  redis.close();
});

Deno.test("Connection - Invalid authentication", async () => {
  // Skip if no password is set in test config
  if (!TEST_REDIS_AUTH_CONFIG.password) {
    return;
  }

  await assertRejects(
    async () => {
      await connect({
        ...TEST_REDIS_AUTH_CONFIG,
        password: "wrong-password",
      });
    },
    AuthenticationError,
    "Authentication failed",
  );
});

Deno.test("Connection - Connection to invalid host", async () => {
  await assertRejects(
    async () => {
      await connect({
        hostname: "invalid-redis-host",
        port: 6379,
        maxRetryCount: 1, // Fail fast
      });
    },
    Error,
  );
});

Deno.test("Connection - Close and reconnect behavior", async () => {
  const redis = await createTestRedis();

  // Close connection
  redis.close();
  assertEquals(redis.isClosed, true);

  // Trying to send command to closed connection should fail
  await assertRejects(
    async () => {
      await redis.ping();
    },
    ConnectionClosedError,
  );
});
