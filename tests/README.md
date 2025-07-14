# Testing Guide

This directory contains comprehensive tests for the deno-redis library, ensuring reliability and performance across all Redis operations.

## 📁 Test Structure

| File | Description |
|------|-------------|
| `test_helper.ts` | Common test utilities, Redis configurations, and connection helpers |
| `connection_test.ts` | Connection management, error handling, and network resilience tests |
| `commands_test.ts` | Comprehensive Redis command implementation tests |
| `pubsub_test.ts` | Pub/Sub messaging and channel subscription tests |
| `pipeline_test.ts` | Pipeline operations and transaction tests |
| `stream_test.ts` | Redis streams and consumer group functionality tests |
| `integration_test.ts` | Full integration, performance, and end-to-end tests |
| `verify_setup.ts` | Setup verification utility for test environment |
| `mod.ts` | Test module exports |

## 🚀 Quick Start

### Prerequisites

Choose one of the following setup methods:

#### Option 1: Docker (Recommended)
```bash
# Navigate to docker directory and start Redis instances
cd docker
./setup.sh start
```

#### Option 2: Manual Redis Setup
- Redis server running on `127.0.0.1:6379`
- Optional: Redis with auth on `127.0.0.1:6380` (password: `testpass123`)
- Optional: Redis with custom config on `127.0.0.1:6381`

### Verify Setup
```bash
# Verify your Redis setup is working
deno task verify
```

### Run Tests

```bash
# Run all tests
deno task test

# Run tests with file watching (auto-reload on changes)
deno task test:watch

# Run specific test file
deno test --allow-net --allow-env tests/connection_test.ts

# Run tests with detailed output
deno test --allow-net --allow-env --verbose tests/

# Run only integration tests
deno test --allow-net --allow-env tests/integration_test.ts

# Run tests matching a pattern
deno test --allow-net --allow-env --filter="connection" tests/
```

## ⚙️ Configuration

### Environment Variables

The test suite supports the following environment variables for flexible configuration:

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis hostname | `127.0.0.1` |
| `REDIS_PORT` | Primary Redis port | `6379` |
| `REDIS_PASSWORD` | Primary Redis password | None |
| `REDIS_AUTH_PORT` | Auth-enabled Redis port | `6380` |
| `REDIS_AUTH_PASSWORD` | Auth Redis password | `testpass123` |
| `REDIS_CONFIG_PORT` | Custom config Redis port | `6381` |

### Example Configuration

```bash
# Custom Redis configuration
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_PASSWORD=mypassword

# Run tests with custom config
deno task test
```

## 🐳 Docker Testing Environment

The Docker setup provides a complete testing environment with multiple Redis configurations:

| Service | Port | Description | Use Case |
|---------|------|-------------|----------|
| **Basic Redis** | `6379` | Standard Redis instance | General testing |
| **Auth Redis** | `6380` | Password-protected Redis | Authentication testing |
| **Config Redis** | `6381` | Custom configuration Redis | Advanced feature testing |
| **Redis Insight** | `8001` | Web UI for Redis management | Development and debugging |

### Docker Commands

```bash
# Start all Redis instances
cd docker && ./setup.sh start

# Check status of Redis containers
cd docker && ./setup.sh status

# View Redis logs
cd docker && ./setup.sh logs

# Stop all instances
cd docker && ./setup.sh stop

# Clean up (remove containers and volumes)
cd docker && ./setup.sh clean
```

### Access Redis Insight
Navigate to [http://localhost:8001](http://localhost:8001) to access the Redis web interface for monitoring and debugging.

## 📊 Test Coverage

The comprehensive test suite covers all major Redis functionality:

### ✅ Core Features
- **Connection Management**: Connection pooling, retry logic, and error recovery
- **Data Types**: Strings, lists, sets, hashes, sorted sets, bitmaps, and HyperLogLog
- **Advanced Features**: Redis streams, consumer groups, and geospatial data
- **Messaging**: Pub/Sub channels, pattern subscriptions, and message routing
- **Transactions**: Pipeline operations, MULTI/EXEC transactions, and atomic operations
- **Memory Management**: Connection cleanup, resource disposal, and memory optimization

### ✅ Quality Assurance
- **Error Handling**: Network failures, timeout scenarios, and edge cases
- **Performance**: Throughput benchmarks, latency measurements, and stress testing
- **Reliability**: Connection resilience, automatic reconnection, and failover handling
- **Security**: Authentication testing, password validation, and secure connections

### Coverage Metrics
Run tests with coverage reporting:
```bash
# Generate coverage report
deno test --allow-net --allow-env --coverage=coverage tests/

# View coverage in HTML format
deno coverage coverage --html
```

## 🔧 Troubleshooting

### Common Issues and Solutions

#### Connection Problems

| Issue | Cause | Solution |
|-------|-------|----------|
| **Redis not running** | Redis server not started | Run `docker/setup.sh start` or start Redis manually |
| **Port conflicts** | Ports 6379-6381 already in use | Stop conflicting services or change port configuration |
| **Permission denied** | Docker permissions issue | Ensure user is in docker group: `sudo usermod -aG docker $USER` |
| **Connection timeout** | Network/firewall blocking | Check firewall settings and allow Redis ports |

#### Test Failures

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| **Flaky/intermittent tests** | Async operations not properly awaited | Ensure proper `await` usage and cleanup |
| **Memory issues** | Connections not closed | Always call `redis.close()` in `finally` blocks |
| **Test isolation** | State from previous tests affecting current test | Clear Redis data between tests with `FLUSHALL` |
| **Performance variance** | System load affecting benchmarks | Run tests on quiet system or increase timeouts |

#### Environment Issues

```bash
# Debug Redis connectivity
deno task verify

# Check Redis logs
cd docker && ./setup.sh logs redis-basic

# Test specific Redis instance
redis-cli -h 127.0.0.1 -p 6379 ping

# Check port availability
netstat -tulpn | grep :6379
```

### Getting Help

1. **Check Redis Status**: Use `deno task verify` to test connectivity
2. **Review Logs**: Docker logs often contain helpful error messages
3. **Isolate Issues**: Run individual test files to narrow down problems
4. **Environment**: Ensure environment variables are correctly set

## ⚡ Performance Testing

Some tests include performance benchmarks to ensure optimal Redis operations.

### Running Performance Tests

```bash
# Run integration tests (includes performance benchmarks)
deno test --allow-net --allow-env tests/integration_test.ts

# Run with performance timing
deno test --allow-net --allow-env --reporter=verbose tests/
```

### Benchmark Guidelines

For consistent and reliable performance results:

1. **System Preparation**:
   - Run tests on a quiet system with minimal background processes
   - Ensure adequate system resources (CPU, memory)
   - Use SSD storage for better I/O performance

2. **Redis Configuration**:
   - Allocate sufficient memory to Redis (check `maxmemory` setting)
   - Use appropriate persistence settings for testing
   - Consider disabling Redis persistence for pure performance tests

3. **Network Considerations**:
   - Test locally to minimize network latency
   - Ensure stable network connection
   - Consider connection pooling impact on performance

### Sample Performance Metrics

The test suite tracks key performance indicators:
- Connection establishment time
- Command execution latency
- Throughput (operations per second)
- Memory usage patterns
- Connection pooling efficiency

## 🤝 Contributing

### Adding New Tests

When contributing tests to the deno-redis library:

#### Test Structure Guidelines

1. **Organization**: Group related tests in appropriate files
   - Connection tests → `connection_test.ts`
   - Command tests → `commands_test.ts`
   - Stream tests → `stream_test.ts`
   - etc.

2. **Naming Conventions**:
   ```typescript
   // ✅ Good: Descriptive and specific
   Deno.test("Redis connection should retry on network failure", async () => {
     // test implementation
   });
   
   // ❌ Bad: Vague and unclear
   Deno.test("test connection", async () => {
     // test implementation
   });
   ```

3. **Test Structure Pattern**:
   ```typescript
   Deno.test("Feature description", async () => {
     const redis = await createTestRedis();
     
     try {
       // Arrange: Set up test data
       await redis.set("test:key", "value");
       
       // Act: Perform the operation being tested
       const result = await redis.get("test:key");
       
       // Assert: Verify the results
       assertEquals(result, "value");
       
     } finally {
       // Cleanup: Always clean up resources
       await redis.del("test:key");
       redis.close();
     }
   });
   ```

#### Best Practices

- **Resource Management**: Always close Redis connections in `finally` blocks
- **Test Isolation**: Clean up test data to avoid test interdependencies
- **Error Testing**: Include both success and failure scenarios
- **Documentation**: Add comments for complex test logic
- **Performance**: Consider test execution time and optimize where needed

#### Integration Tests

For complex features, add integration tests that:
- Test end-to-end workflows
- Verify interactions between components
- Include realistic usage scenarios
- Test error recovery and edge cases

#### Example Test Template

```typescript
import { assertEquals, assertRejects } from "@std/assert";
import { createTestRedis } from "./test_helper.ts";

Deno.test("Your feature description", async () => {
  const redis = await createTestRedis();
  
  try {
    // Your test implementation
    
  } finally {
    // Cleanup
    redis.close();
  }
});
```
