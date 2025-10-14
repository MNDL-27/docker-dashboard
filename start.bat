@echo off
REM Docker Dashboard Quick Start Script for Windows
REM Works with both docker-compose and docker compose (V2)

setlocal enabledelayedexpansion

echo.
echo ======================================
echo   Docker Dashboard - Quick Start
echo ======================================
echo.

REM Detect Docker Compose command
docker-compose version >nul 2>&1
if !errorlevel! equ 0 (
    set "COMPOSE_CMD=docker-compose"
    echo Using: docker-compose
) else (
    docker compose version >nul 2>&1
    if !errorlevel! equ 0 (
        set "COMPOSE_CMD=docker compose"
        echo Using: docker compose
    ) else (
        echo Error: Docker Compose not found!
        echo Please install Docker Desktop: https://www.docker.com/products/docker-desktop
        pause
        exit /b 1
    )
)

:menu
echo.
echo Choose an option:
echo   1) Start Dashboard (build ^& run)
echo   2) Start Dashboard (use existing image)
echo   3) Stop Dashboard
echo   4) View Logs
echo   5) Restart Dashboard
echo   6) Rebuild ^& Restart
echo   7) Remove Everything (cleanup)
echo   0) Exit
echo.

set /p choice="Enter choice [0-7]: "

if "%choice%"=="1" goto build_start
if "%choice%"=="2" goto start
if "%choice%"=="3" goto stop
if "%choice%"=="4" goto logs
if "%choice%"=="5" goto restart
if "%choice%"=="6" goto rebuild
if "%choice%"=="7" goto cleanup
if "%choice%"=="0" goto exit
echo Invalid option. Please try again.
goto menu

:build_start
echo.
echo Building and starting dashboard...
%COMPOSE_CMD% up -d --build
echo.
echo Dashboard started!
echo Open: http://localhost:1714
goto menu

:start
echo.
echo Starting dashboard...
%COMPOSE_CMD% up -d
echo.
echo Dashboard started!
echo Open: http://localhost:1714
goto menu

:stop
echo.
echo Stopping dashboard...
%COMPOSE_CMD% down
echo Dashboard stopped!
goto menu

:logs
echo.
echo Showing logs (Ctrl+C to exit)...
%COMPOSE_CMD% logs -f dashboard
goto menu

:restart
echo.
echo Restarting dashboard...
%COMPOSE_CMD% restart
echo Dashboard restarted!
goto menu

:rebuild
echo.
echo Rebuilding and restarting...
%COMPOSE_CMD% down
%COMPOSE_CMD% up -d --build
echo.
echo Dashboard rebuilt and started!
echo Open: http://localhost:1714
goto menu

:cleanup
echo.
echo WARNING: This will remove containers, networks, and volumes!
set /p confirm="Are you sure? (yes/no): "
if /i "%confirm%"=="yes" (
    %COMPOSE_CMD% down -v
    echo Cleanup complete!
) else (
    echo Cancelled.
)
goto menu

:exit
echo.
echo Goodbye!
exit /b 0
