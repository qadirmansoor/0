#!/bin/bash
set -euo pipefail

DATA_DIR=/data
PGDATA="$DATA_DIR/postgres"

PG_VERSION_DIR=$(ls /usr/lib/postgresql | head -1)
PG_BIN="/usr/lib/postgresql/$PG_VERSION_DIR/bin"
export PATH="$PG_BIN:$PATH"

mkdir -p "$DATA_DIR"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "[entrypoint] Initialising Postgres cluster..."
  mkdir -p "$PGDATA"
  chown -R postgres:postgres "$DATA_DIR"
  su postgres -s /bin/bash -c "initdb -D '$PGDATA' --auth=trust -U postgres" >/dev/null
fi

chown -R postgres:postgres "$DATA_DIR"

echo "[entrypoint] Starting Postgres..."
su postgres -s /bin/bash -c "pg_ctl -D '$PGDATA' -l '$DATA_DIR/postgres.log' -o '-c listen_addresses=127.0.0.1 -c unix_socket_directories=$DATA_DIR' -w start"

shutdown() {
  echo "[entrypoint] Shutting down..."
  if [ -n "${NODE_PID:-}" ] && kill -0 "$NODE_PID" 2>/dev/null; then
    kill -TERM "$NODE_PID" 2>/dev/null || true
    wait "$NODE_PID" 2>/dev/null || true
  fi
  su postgres -s /bin/bash -c "pg_ctl -D '$PGDATA' -m fast stop" || true
  exit 0
}
trap shutdown TERM INT

echo "[entrypoint] Provisioning database (role/schema/seed if needed)..."
node /app/init-db.js

# init-db.js writes the resolved DATABASE_URL and a persisted NEXTAUTH_SECRET here
set -a
# shellcheck disable=SC1091
source "$DATA_DIR/runtime.env"
set +a

echo "[entrypoint] Starting app server on port ${PORT:-3000}..."
cd /app/standalone
HOSTNAME=0.0.0.0 node server.js &
NODE_PID=$!

wait "$NODE_PID"
shutdown
