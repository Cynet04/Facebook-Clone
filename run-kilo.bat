@echo off
title Kilo Infinite Loop Runner
color 0A
echo ========================================================
echo STARTING KILO 10-HOUR AUTONOMOUS LOOP
echo If Kilo stops, this script will automatically restart it.
echo To stop everything, just close this black window.
echo ========================================================

:loop
echo.
echo [%time%] Starting new Kilo session...
kilo run --auto "Read TASKS.md and PROGRESS.md. You are in an infinite loop. Pick up exactly where you left off. Implement the next feature, test it, commit it, push it, and immediately start the next one. Do not ask for permission. Do not summarize and stop."

echo.
echo [%time%] Kilo stopped. Restarting in 10 seconds...
timeout /t 10
goto loop