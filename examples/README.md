# Redis Client Examples

This directory contains comprehensive examples demonstrating various features of the Redis client library.

## Running Examples

Make sure you have Redis running locally on `127.0.0.1:6379` (default configuration) before running the examples.

```bash
# Run a specific example
deno run -A examples/basic.ts

# Or use the task
deno task example
```

## Examples Overview

### 1. Basic Operations (`basic.ts`)

Demonstrates fundamental Redis operations:

- Connecting to Redis server
- String operations (GET, SET, INCR, DECR)
- Hash operations (HSET, HGET, HMGET)
- List operations (LPUSH, RPUSH, LRANGE)
- Key management (EXISTS, EXPIRE, TTL)
- Error handling
- Connection cleanup

**Topics covered:**

- Connection establishment
- Basic data types
- Error handling patterns
- Resource cleanup

### 2. Pub/Sub Messaging (`pubsub.ts`)

Comprehensive Redis publish/subscribe messaging demonstration:

- Basic channel subscriptions and message publishing
- Pattern-based subscriptions with wildcards (`user:*`, `log:*`)
- Multiple subscribers and message broadcasting
- Real-time messaging simulation (chat room example)
- Dynamic subscription management (add/remove channels)
- Advanced monitoring patterns with message statistics
- Error handling and graceful connection cleanup
- Performance tracking and analytics

**Topics covered:**

- Publisher/Subscriber pattern fundamentals
- Pattern matching and flexible routing
- Concurrent message handling across multiple subscribers
- Real-time communication patterns
- Dynamic subscription management
- Message statistics and monitoring
- Best practices for pub/sub architectures

### 3. Pipelining (`pipeline.ts`)

Demonstrates command pipelining for performance:

- Basic pipeline usage
- Performance comparisons
- Batch data processing
- Error handling in pipelines
- Transaction-like operations

**Topics covered:**

- Command batching
- Performance optimization
- Error handling in batches
- Atomic-like operations

### 4. Redis Streams (`streams.ts`)

Comprehensive Redis Streams functionality demonstration:

- Basic stream operations with automatic and custom IDs
- Stream range queries (forward, reverse, by ID, with limits)
- Consumer groups for distributed message processing
- Real-time event processing with blocking reads
- Stream information and monitoring commands
- Memory management with stream trimming (MAXLEN, MINID)
- Multiple consumers with task distribution
- Event sourcing patterns and best practices
- IoT sensor data simulation
- Application event processing workflow

**Topics covered:**

- Event streaming and message ordering
- Consumer groups and distributed processing
- Message acknowledgment and delivery guarantees
- Stream queries and data retrieval patterns
- Real-time processing with blocking operations
- Memory management and stream maintenance
- Event sourcing architectures
- IoT and time-series data handling

### 5. Advanced Features (`advanced.ts`)

Explores advanced Redis features:

- Redis transactions (MULTI/EXEC)
- Optimistic locking with WATCH
- Connection pooling simulation
- Advanced data structures
- Error handling and recovery
- Health checks

**Topics covered:**

- ACID transactions
- Concurrent access patterns
- Connection management
- Advanced data types

## Prerequisites

### Redis Server

Make sure Redis is installed and running:

```bash
# macOS with Homebrew
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis-server

# Docker
docker run -d -p 6379:6379 redis:latest
```

### Permissions

Examples require network permissions:

```bash
# Allow network access
deno run --allow-net examples/basic.ts

# Or allow all permissions
deno run -A examples/basic.ts
```

## Configuration

Examples use default Redis configuration:

- **Host**: `127.0.0.1`
- **Port**: `6379`
- **Database**: `0`
- **No authentication**

To use different settings, modify the connection configuration in each example:

```typescript
const redis = await connect({
  hostname: "your-redis-host",
  port: 6380,
  password: "your-password",
  db: 1,
});
```

## Environment Variables

You can also use environment variables:

```bash
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_PASSWORD=mypassword

deno run --allow-net --allow-env examples/basic.ts
```

## Example Patterns

### Error Handling

All examples demonstrate proper error handling:

```typescript
try {
  const redis = await connect(config);
  // ... operations
} catch (error) {
  if (error instanceof ConnectionClosedError) {
    console.error("Connection closed");
  } else if (error instanceof AuthenticationError) {
    console.error("Authentication failed");
  } else {
    console.error("Unexpected error:", error);
  }
} finally {
  redis.close();
}
```

### Resource Cleanup

Always close connections when done:

```typescript
const redis = await connect(config);
try {
  // ... operations
} finally {
  redis.close(); // Always cleanup
}
```

### Performance Monitoring

Examples include timing measurements:

```typescript
const start = performance.now();
await operation();
const time = performance.now() - start;
console.log(`Operation took ${time.toFixed(2)}ms`);
```

## Troubleshooting

### Connection Issues

```
Error: Connection refused
```

- Make sure Redis is running
- Check host/port configuration
- Verify firewall settings

### Authentication Errors

```
Error: Authentication failed
```

- Check Redis AUTH configuration
- Verify username/password
- Ensure Redis is configured for authentication

### Permission Errors

```
Error: Network access is not allowed
```

- Run with `--allow-net` flag
- Or use `--allow-all` / `-A` for all permissions

### Memory Issues

```
Error: Out of memory
```

- Check Redis memory configuration
- Monitor Redis memory usage
- Use appropriate data expiration

## Best Practices

1. **Always close connections**: Use try/finally blocks
2. **Handle errors gracefully**: Use appropriate error types
3. **Use pipelining**: For multiple operations
4. **Monitor performance**: Measure operation timing
5. **Clean up test data**: Remove keys after examples
6. **Use connection pooling**: For high-throughput applications

## Contributing

When adding new examples:

1. Follow the existing file structure
2. Include comprehensive comments
3. Add error handling
4. Clean up test data
5. Update this README
6. Test with a clean Redis instance

---

For more information, see the main [README.md](../README.md) and [API documentation](../docs/).
