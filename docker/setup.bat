@echo off
REM Docker setup script for Redis testing environment (Windows)

setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."

REM Check if Docker is installed and running
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed. Please install Docker first.
    exit /b 1
)

docker info >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running. Please start Docker first.
    exit /b 1
)

REM Check for Docker Compose
docker compose version >nul 2>nul
if %errorlevel% neq 0 (
    docker-compose version >nul 2>nul
    if %errorlevel% neq 0 (
        echo [ERROR] Docker Compose is not available. Please install Docker Compose.
        exit /b 1
    )
    set "COMPOSE_CMD=docker-compose"
) else (
    set "COMPOSE_CMD=docker compose"
)

cd /d "%PROJECT_DIR%"

if "%1"=="start" goto start_redis
if "%1"=="start-tools" goto start_with_insight
if "%1"=="stop" goto stop_redis
if "%1"=="status" goto status_redis
if "%1"=="logs" goto logs_redis
if "%1"=="reset" goto reset_redis
if "%1"=="test" goto test_redis
if "%1"=="run-tests" goto run_tests
if "%1"=="help" goto show_help
if "%1"=="-h" goto show_help
if "%1"=="--help" goto show_help
if "%1"=="" goto show_help
goto unknown_command

:start_redis
echo [INFO] Starting Redis containers...
%COMPOSE_CMD% up -d redis redis-auth redis-config
echo [SUCCESS] Redis containers started!
echo [INFO] Available Redis instances:
echo   - Basic Redis: localhost:6379
echo   - Redis with auth: localhost:6380 (password: testpass123)
echo   - Redis with config: localhost:6381
goto end

:start_with_insight
echo [INFO] Starting Redis containers with Redis Insight...
%COMPOSE_CMD% --profile tools up -d
echo [SUCCESS] Redis containers and Redis Insight started!
echo [INFO] Available services:
echo   - Basic Redis: localhost:6379
echo   - Redis with auth: localhost:6380 (password: testpass123)
echo   - Redis with config: localhost:6381
echo   - Redis Insight: http://localhost:8001
goto end

:stop_redis
echo [INFO] Stopping Redis containers...
%COMPOSE_CMD% down
echo [SUCCESS] Redis containers stopped!
goto end

:status_redis
echo [INFO] Redis container status:
%COMPOSE_CMD% ps
goto end

:logs_redis
set "service=%2"
if "%service%"=="" set "service=redis"
echo [INFO] Showing logs for %service%...
%COMPOSE_CMD% logs -f %service%
goto end

:reset_redis
echo [WARNING] This will remove all Redis data. Are you sure? (y/N)
set /p "confirmation="
if /i "!confirmation!"=="y" (
    echo [INFO] Stopping containers and removing volumes...
    %COMPOSE_CMD% down -v
    echo [SUCCESS] Redis data reset complete!
) else (
    echo [INFO] Reset cancelled.
)
goto end

:test_redis
echo [INFO] Testing Redis connections...

docker exec deno-redis-test redis-cli ping >nul 2>nul
if %errorlevel% equ 0 (
    echo [SUCCESS] Basic Redis (port 6379): OK
) else (
    echo [ERROR] Basic Redis (port 6379): FAILED
)

docker exec deno-redis-auth redis-cli -a testpass123 ping >nul 2>nul
if %errorlevel% equ 0 (
    echo [SUCCESS] Redis with auth (port 6380): OK
) else (
    echo [ERROR] Redis with auth (port 6380): FAILED
)

docker exec deno-redis-config redis-cli ping >nul 2>nul
if %errorlevel% equ 0 (
    echo [SUCCESS] Redis with config (port 6381): OK
) else (
    echo [ERROR] Redis with config (port 6381): FAILED
)
goto end

:run_tests
echo [INFO] Running tests with Docker Redis instances...
set "REDIS_HOST=127.0.0.1"
set "REDIS_PORT=6379"
deno task test
if %errorlevel% equ 0 (
    echo [SUCCESS] All tests passed!
) else (
    echo [ERROR] Some tests failed!
    exit /b 1
)
goto end

:show_help
echo Docker Redis Setup Script (Windows)
echo.
echo Usage: %0 [COMMAND]
echo.
echo Commands:
echo   start         Start Redis containers
echo   start-tools   Start Redis containers with Redis Insight
echo   stop          Stop Redis containers
echo   status        Show container status
echo   logs [SERVICE] Show logs (default: redis)
echo   reset         Reset Redis data (removes volumes)
echo   test          Test Redis connections
echo   run-tests     Run Deno tests with Docker Redis
echo   help          Show this help message
echo.
echo Examples:
echo   %0 start                 # Start basic Redis setup
echo   %0 start-tools          # Start with Redis Insight
echo   %0 logs redis-auth      # Show auth Redis logs
echo   %0 run-tests            # Run tests against Docker Redis
goto end

:unknown_command
echo [ERROR] Unknown command: %1
call :show_help
exit /b 1

:end
endlocal
