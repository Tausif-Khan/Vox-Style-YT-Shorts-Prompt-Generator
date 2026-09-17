#!/bin/sh
# Durable dev entrypoint — used as the Freebuff preview command.
# Guarantees: Vite always serves on $PORT (no 502), and the Convex backend
# is supervised: if it ever crashes (bad push, restart, etc.) it is
# restarted automatically instead of leaving the app dead.

PORT="${PORT:-3000}"
LOG=/tmp/convex-dev.log

echo "[dev.sh] starting Convex supervisor (log: $LOG)" >&2

# Supervised Convex backend: restart forever, 3s backoff.
(
  while true; do
    bunx convex dev >> "$LOG" 2>&1
    echo "[dev.sh] $(date) convex dev exited ($?); restarting in 3s" >> "$LOG"
    sleep 3
  done
) &

# Wait for backend readiness (max ~60s) before serving the frontend.
i=0
until curl -s -o /dev/null --max-time 2 http://127.0.0.1:3210; do
  i=$((i + 1))
  if [ "$i" -gt 30 ]; then
    echo "[dev.sh] backend not ready after 60s; starting frontend anyway" >&2
    break
  fi
  sleep 2
done
echo "[dev.sh] backend ready; starting Vite on port $PORT" >&2

# Vite in the foreground: it IS the preview process the platform watches.
exec bunx vite --port "$PORT" --host 0.0.0.0
