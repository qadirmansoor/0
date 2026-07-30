# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS builder
WORKDIR /repo
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim AS runner
ENV DEBIAN_FRONTEND=noninteractive
# Skip creating apt's default Postgres cluster — we run our own initdb
# into a custom, volume-backed data directory at container startup.
RUN mkdir -p /etc/postgresql-common/createcluster.d \
    && echo "create_main_cluster = false" > /etc/postgresql-common/createcluster.d/no-main.conf \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY docker/package.json docker/package-lock.json* ./
RUN npm install --omit=dev

COPY --from=builder /repo/.next/standalone ./standalone
COPY --from=builder /repo/.next/static ./standalone/.next/static
COPY --from=builder /repo/public ./standalone/public
COPY --from=builder /repo/prisma/migrations ./migrations
COPY docker/init-db.js docker/seed.js ./
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
    && rm -f ./standalone/.env

ENV DATA_DIR=/data
ENV PORT=3000
EXPOSE 3000
VOLUME ["/data"]

ENTRYPOINT ["/entrypoint.sh"]
