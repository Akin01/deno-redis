#!/bin/bash

# Docker setup script for Redis testing environment
# This script helps manage Redis containers for testing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed and running
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi
}

# Start Redis containers
start_redis() {
    print_status "Starting Redis containers..."
    cd "$PROJECT_DIR"
    
    if docker compose version &> /dev/null; then
        docker compose up -d redis redis-auth redis-config
    else
        docker-compose up -d redis redis-auth redis-config
    fi
    
    print_success "Redis containers started!"
    print_status "Available Redis instances:"
    echo "  - Basic Redis: localhost:6379"
    echo "  - Redis with auth: localhost:6380 (password: testpass123)"
    echo "  - Redis with config: localhost:6381"
}

# Start with Redis Insight
start_with_insight() {
    print_status "Starting Redis containers with Redis Insight..."
    cd "$PROJECT_DIR"
    
    if docker compose version &> /dev/null; then
        docker compose --profile tools up -d
    else
        docker-compose --profile tools up -d
    fi
    
    print_success "Redis containers and Redis Insight started!"
    print_status "Available services:"
    echo "  - Basic Redis: localhost:6379"
    echo "  - Redis with auth: localhost:6380 (password: testpass123)"
    echo "  - Redis with config: localhost:6381"
    echo "  - Redis Insight: http://localhost:8001"
}

# Stop Redis containers
stop_redis() {
    print_status "Stopping Redis containers..."
    cd "$PROJECT_DIR"
    
    if docker compose version &> /dev/null; then
        docker compose down
    else
        docker-compose down
    fi
    
    print_success "Redis containers stopped!"
}

# Check Redis container status
status_redis() {
    print_status "Redis container status:"
    cd "$PROJECT_DIR"
    
    if docker compose version &> /dev/null; then
        docker compose ps
    else
        docker-compose ps
    fi
}

# Show Redis logs
logs_redis() {
    local service=${1:-redis}
    print_status "Showing logs for $service..."
    cd "$PROJECT_DIR"
    
    if docker compose version &> /dev/null; then
        docker compose logs -f "$service"
    else
        docker-compose logs -f "$service"
    fi
}

# Reset Redis data (remove volumes)
reset_redis() {
    print_warning "This will remove all Redis data. Are you sure? (y/N)"
    read -r confirmation
    if [[ $confirmation =~ ^[Yy]$ ]]; then
        print_status "Stopping containers and removing volumes..."
        cd "$PROJECT_DIR"
        
        if docker compose version &> /dev/null; then
            docker compose down -v
        else
            docker-compose down -v
        fi
        
        print_success "Redis data reset complete!"
    else
        print_status "Reset cancelled."
    fi
}

# Test Redis connections
test_redis() {
    print_status "Testing Redis connections..."
    
    # Test basic Redis
    if docker exec deno-redis-test redis-cli ping &> /dev/null; then
        print_success "Basic Redis (port 6379): OK"
    else
        print_error "Basic Redis (port 6379): FAILED"
    fi
    
    # Test Redis with auth
    if docker exec deno-redis-auth redis-cli -a testpass123 ping &> /dev/null; then
        print_success "Redis with auth (port 6380): OK"
    else
        print_error "Redis with auth (port 6380): FAILED"
    fi
    
    # Test Redis with config
    if docker exec deno-redis-config redis-cli ping &> /dev/null; then
        print_success "Redis with config (port 6381): OK"
    else
        print_error "Redis with config (port 6381): FAILED"
    fi
}

# Run tests with Docker Redis
run_tests() {
    print_status "Running tests with Docker Redis instances..."
    cd "$PROJECT_DIR"
    
    # Set environment variables for Docker Redis
    export REDIS_HOST=127.0.0.1
    export REDIS_PORT=6379
    
    # Run the tests
    if deno task test; then
        print_success "All tests passed!"
    else
        print_error "Some tests failed!"
        exit 1
    fi
}

# Show help
show_help() {
    echo "Docker Redis Setup Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start         Start Redis containers"
    echo "  start-tools   Start Redis containers with Redis Insight"
    echo "  stop          Stop Redis containers"
    echo "  status        Show container status"
    echo "  logs [SERVICE] Show logs (default: redis)"
    echo "  reset         Reset Redis data (removes volumes)"
    echo "  test          Test Redis connections"
    echo "  run-tests     Run Deno tests with Docker Redis"
    echo "  help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start                 # Start basic Redis setup"
    echo "  $0 start-tools          # Start with Redis Insight"
    echo "  $0 logs redis-auth      # Show auth Redis logs"
    echo "  $0 run-tests            # Run tests against Docker Redis"
}

# Main script logic
main() {
    check_docker
    
    case "${1:-help}" in
        start)
            start_redis
            ;;
        start-tools)
            start_with_insight
            ;;
        stop)
            stop_redis
            ;;
        status)
            status_redis
            ;;
        logs)
            logs_redis "$2"
            ;;
        reset)
            reset_redis
            ;;
        test)
            test_redis
            ;;
        run-tests)
            run_tests
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
