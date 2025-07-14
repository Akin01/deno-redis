# Deno Redis Client

A modern, fully-typed Redis client for Deno with enhanced performance, comprehensive TypeScript support, and native JSR compatibility.

[![JSR](https://jsr.io/badges/@akin01/deno-redis)](https://jsr.io/@akin01/deno-redis)
[![JSR Score](https://jsr.io/badges/@akin01/deno-redis/score)](https://jsr.io/@akin01/deno-redis)

> **Modern rewrite** of [`deno.land/x/redis@v0.27.1`](https://deno.land/x/redis@v0.27.1) - optimized for current Deno standards with ~95% API compatibility.

## Why This Rewrite?

Built from the ground up for modern Deno development:

- 🚀 **Performance**: Optimized RESP2 protocol with better buffering and connection management
- 🔧 **TypeScript**: Full type safety with comprehensive definitions for all Redis commands
- 📦 **JSR Native**: Purpose-built for JSR with minimal dependencies (@std/async, @std/streams)
- 🛡️ **Reliability**: Enhanced error handling with custom error types and exponential backoff
- 🏗️ **Architecture**: Clean, modular design with separation of concerns

## Features

### Core Redis Support
- **Complete Command Coverage**: All Redis commands across strings, hashes, lists, sets, sorted sets, and more
- **Redis Streams**: Full stream support with consumer groups (XREAD, XADD, XGROUP, etc.)
- **Pub/Sub Messaging**: Channel and pattern subscriptions with async iterators  
- **Transactions**: MULTI/EXEC with proper rollback support
- **Pipelining**: Batch commands for high-performance scenarios

### Advanced Connection Management
- **Auto-Reconnection**: Exponential backoff with configurable retry strategies
- **TLS/SSL Support**: Secure connections with certificate validation
- **Authentication**: Redis ACL and password-based auth
- **Connection Pooling**: MuxExecutor for efficient command multiplexing
- **Lazy Connections**: Connect only when needed

### Developer Experience
- **Full TypeScript**: Comprehensive type definitions for all Redis operations
- **Modern API**: Promise-based with async/await patterns
- **URL Parsing**: Easy configuration with Redis connection strings
- **Rich Error Types**: Specific error classes for different failure scenarios
- **Extensive Documentation**: Complete examples and API reference

## Installation

```bash
# Add to your Deno project
deno add jsr:@akin01/deno-redis
```

```typescript
import { connect } from "jsr:@akin01/deno-redis";
```

### Migration from deno.land/x/redis

```typescript
// Before: deno.land/x/redis@v0.27.1
// import { connect } from "https://deno.land/x/redis@v0.27.1/mod.ts";

// After: JSR package
import { connect } from "jsr:@akin01/deno-redis";

// API is ~95% compatible - most code works unchanged
const redis = await connect({ hostname: "127.0.0.1", port: 6379 });
```

## Quick Start

### Basic Usage

```typescript
import { connect } from "jsr:@akin01/deno-redis";

const redis = await connect({
  hostname: "127.0.0.1",
  port: 6379,
});

// String operations
await redis.set("user:1", "John Doe");
const user = await redis.get("user:1"); // "John Doe"

// Hash operations  
await redis.hset("user:1:profile", "name", "John", "age", "30");
const profile = await redis.hgetall("user:1:profile");

// List operations
await redis.lpush("tasks", "task1", "task2", "task3");
const tasks = await redis.lrange("tasks", 0, -1);

redis.close();
```

### Connection Configuration

```typescript
import { connect, parseURL } from "jsr:@akin01/deno-redis";

// Object configuration
const redis = await connect({
  hostname: "redis.example.com",
  port: 6380,
  tls: true,
  username: "myuser",
  password: "mypass",
  db: 1,
  maxRetryCount: 10,
  name: "myapp-connection",
});

// URL configuration
const urlOptions = parseURL("redis://user:pass@localhost:6379/1");
const redisFromUrl = await connect(urlOptions);

// TLS URL
const tlsOptions = parseURL("rediss://user:pass@redis.example.com:6380/0");
const redisSecure = await connect(tlsOptions);
```

### Lazy Connections

```typescript
import { createLazyClient } from "jsr:@akin01/deno-redis";

// Client created but not connected
const redis = createLazyClient({ hostname: "127.0.0.1", port: 6379 });
console.log(redis.isConnected); // false

// Connection established on first operation
await redis.ping();
console.log(redis.isConnected); // true
```

## Advanced Usage

### Pub/Sub Messaging

```typescript
const redis = await connect({ hostname: "127.0.0.1", port: 6379 });

// Subscribe to specific channels
const sub = await redis.subscribe("notifications", "alerts");
for await (const { channel, message } of sub.receive()) {
  console.log(`[${channel}] ${message}`);
}

// Pattern-based subscriptions
const psub = await redis.psubscribe("user:*", "session:*");
for await (const { pattern, channel, message } of psub.receive()) {
  console.log(`[${pattern}] ${channel}: ${message}`);
}
```

### Command Pipelining

```typescript
const redis = await connect({ hostname: "127.0.0.1", port: 6379 });

// Create pipeline for batch operations
const pipeline = redis.pipeline();
pipeline.set("key1", "value1");
pipeline.set("key2", "value2");
pipeline.incr("counter");
pipeline.get("key1");

// Execute all commands atomically
const [setResult1, setResult2, counterValue, getValue] = await pipeline.flush();
```

### Redis Streams

```typescript
const redis = await connect({ hostname: "127.0.0.1", port: 6379 });

// Producer: Add messages to stream
await redis.xadd("events", "*", {
  type: "user_signup",
  userId: "12345",
  timestamp: Date.now()
});

// Consumer: Read from stream
const messages = await redis.xread([{ key: "events", xid: "0-0" }], { 
  count: 10,
  block: 1000 
});

// Consumer groups for distributed processing
await redis.xgroupCreate("events", "processors", "$");
const groupMessages = await redis.xreadgroup(
  [{ key: "events", xid: ">" }],
  { group: "processors", consumer: "worker-1", count: 5 }
);

for (const stream of groupMessages) {
  for (const message of stream.messages) {
    console.log(`Processing: ${message.xid}`, message.fieldValues);
    // Acknowledge processing
    await redis.xack("events", "processors", message.xid);
  }
}
```

### Transactions

```typescript
const redis = await connect({ hostname: "127.0.0.1", port: 6379 });

// Execute multiple commands atomically
await redis.multi();
await redis.set("account:1", "1000");
await redis.set("account:2", "500"); 
await redis.incr("total_accounts");

const results = await redis.exec();
console.log("Transaction completed:", results);

// With optimistic locking
await redis.watch("account:1");
const balance = await redis.get("account:1");
if (parseInt(balance) >= 100) {
  await redis.multi();
  await redis.decrby("account:1", 100);
  await redis.incrby("account:2", 100);
  await redis.exec();
}
```

### Error Handling

```typescript
import { 
  connect, 
  ConnectionClosedError, 
  AuthenticationError,
  ErrorReplyError 
} from "jsr:@akin01/deno-redis";

try {
  const redis = await connect({
    hostname: "127.0.0.1",
    port: 6379,
    password: "wrongpassword"
  });
  
  await redis.get("somekey");
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error("Authentication failed - check credentials");
  } else if (error instanceof ConnectionClosedError) {
    console.error("Connection lost - implementing retry logic");
  } else if (error instanceof ErrorReplyError) {
    console.error("Redis command error:", error.message);
  } else {
    console.error("Unexpected error:", error);
  }
}
```

## Performance Optimization

### Connection Pooling

```typescript
class RedisPool {
  private connections: Redis[] = [];
  private currentIndex = 0;

  async init(size: number, options: RedisConnectOptions) {
    this.connections = await Promise.all(
      Array(size).fill(0).map(() => connect(options))
    );
  }

  getConnection(): Redis {
    const conn = this.connections[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.connections.length;
    return conn;
  }

  async close() {
    await Promise.all(this.connections.map(conn => conn.close()));
  }
}

// Usage
const pool = new RedisPool();
await pool.init(5, { hostname: "127.0.0.1", port: 6379 });

// Use pooled connections
const redis = pool.getConnection();
await redis.get("key");
```

### Efficient Batch Operations

```typescript
// ❌ Inefficient: Sequential operations
for (const key of keys) {
  await redis.get(key);
}

// ✅ Efficient: Use pipelining
const pipeline = redis.pipeline();
keys.forEach(key => pipeline.get(key));
const values = await pipeline.flush();

// ✅ Efficient: Use MGET for multiple keys
const values = await redis.mget(...keys);
```

## API Reference

### Redis Client Interface

```typescript
interface Redis {
  // Connection state
  readonly isClosed: boolean;
  readonly isConnected: boolean;
  
  // Core operations
  sendCommand(command: string, ...args: RedisValue[]): Promise<RedisReply>;
  close(): void;
  pipeline(): Pipeline;
  
  // String operations
  get(key: string): Promise<string | null>;
  set(key: string, value: RedisValue, options?: SetOptions): Promise<string>;
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  
  // Hash operations
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: RedisValue): Promise<number>;
  hgetall(key: string): Promise<Record<string, string>>;
  
  // List operations
  lpush(key: string, ...values: RedisValue[]): Promise<number>;
  rpush(key: string, ...values: RedisValue[]): Promise<number>;
  lpop(key: string): Promise<string | null>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  
  // Set operations
  sadd(key: string, ...members: RedisValue[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  
  // Sorted set operations
  zadd(key: string, score: number, member: RedisValue): Promise<number>;
  zrange(key: string, start: number, stop: number): Promise<string[]>;
  
  // Stream operations
  xadd(key: string, id: string, fields: Record<string, RedisValue>): Promise<string>;
  xread(streams: XReadStreamID[], options?: XReadOptions): Promise<XReadResponse[]>;
  
  // Pub/Sub
  subscribe(...channels: string[]): Promise<RedisSubscription>;
  psubscribe(...patterns: string[]): Promise<RedisSubscription>;
  
  // Transactions
  multi(): Promise<string>;
  exec(): Promise<RedisReply[]>;
  watch(...keys: string[]): Promise<string>;
  
  // ... and hundreds more Redis commands
}
```

### Connection Options

```typescript
interface RedisConnectOptions {
  hostname: string;
  port?: number | string;
  tls?: boolean;
  db?: number;
  password?: string;
  username?: string;
  name?: string;
  maxRetryCount?: number;
  backoff?: Backoff;
}

interface Backoff {
  multiplier?: number;
  jitter?: number;
  maxDelay?: number;
}
```

### Error Types

| Error Class | Description |
|-------------|-------------|
| `ConnectionClosedError` | Connection was closed unexpectedly |
| `AuthenticationError` | Invalid credentials provided |
| `ErrorReplyError` | Redis server returned an error response |
| `EOFError` | Unexpected end of data stream |
| `InvalidStateError` | Client is in an invalid state |
| `SubscriptionClosedError` | Pub/Sub subscription was closed |

## Examples & Documentation

Explore the `/examples` directory for comprehensive usage patterns:

| Example | Description |
|---------|-------------|
| [`basic.ts`](examples/basic.ts) | Essential Redis operations and connection setup |
| [`pubsub.ts`](examples/pubsub.ts) | Pub/Sub messaging patterns |
| [`streams.ts`](examples/streams.ts) | Redis Streams with consumer groups |
| [`pipeline.ts`](examples/pipeline.ts) | Command batching and pipelining |
| [`advanced.ts`](examples/advanced.ts) | Complex scenarios and best practices |

## Development

### Commands

```bash
# Run tests
deno task test

# Format code
deno task fmt

# Lint code
deno task lint

# Type check
deno task check
```

### Local Development Setup

```bash
git clone https://github.com/akin01/deno-redis.git
cd deno-redis

# Verify setup
deno task check
deno task test

# Format and lint
deno task fmt && deno task lint
```

### Running Examples

```bash
# Start Redis (via Docker)
docker-compose up -d

# Run examples
deno run --allow-net examples/basic.ts
deno run --allow-net examples/pubsub.ts
```

## Contributing

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/awesome-feature`
3. **Implement** your changes with tests
4. **Verify**: `deno task test && deno task fmt && deno task lint`
5. **Submit** a pull request

### Development Guidelines

- **Type Safety**: Maintain comprehensive TypeScript types
- **Testing**: Add tests for new functionality
- **Documentation**: Update examples and API docs
- **Performance**: Consider impact on benchmarks
- **Compatibility**: Ensure Redis protocol compliance

## Compatibility & Migration

### Version Support
- **Deno**: 2.2+ (latest stable recommended)
- **Redis**: 6.0+ (RESP2 protocol)
- **Original API**: ~95% compatible with `deno.land/x/redis@v0.27.1`
- **JSR**: Native support with optimized module exports

### Migration from Original

Most code works unchanged when switching imports:

```typescript
// Before
import { connect } from "https://deno.land/x/redis@v0.27.1/mod.ts";

// After  
import { connect } from "jsr:@akin01/deno-redis";
```

### Breaking Changes

Minor adjustments needed for:

1. **Import paths**: Update to JSR package
2. **Error handling**: Enhanced error types may require catch block updates
3. **TypeScript**: Stricter typing might surface existing type issues
4. **Dependencies**: Now uses only essential @std libraries

## Roadmap

- [ ] **RESP3 Protocol**: Support for Redis 6+ enhanced protocol
- [ ] **Redis Cluster**: Multi-node Redis cluster support
- [ ] **Redis Sentinel**: High-availability configuration support  
- [ ] **Performance Tools**: Built-in benchmarking and profiling utilities
- [ ] **Redis 7.x Features**: Functions, ACL improvements, and more
- [ ] **Connection Pooling**: Advanced pooling strategies and management

## Acknowledgments

This project builds upon the excellent foundation of [`deno.land/x/redis`](https://deno.land/x/redis). We thank the original contributors for their pioneering work in bringing Redis to the Deno ecosystem.

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ for the Deno community**

*A modern Redis client optimized for performance, type safety, and developer experience*

[JSR Package](https://jsr.io/@akin01/deno-redis) • [GitHub Repository](https://github.com/akin01/deno-redis) • [Examples](examples/)

</div>
