# syntax=docker/dockerfile:1

# ---- Stage 1: builder (full deps, generate Prisma client, compile TS) -------
FROM node:20-alpine AS builder
WORKDIR /app
# Prisma's engines need OpenSSL (absent from node:20-alpine).
RUN apk add --no-cache openssl

# Install against every workspace manifest for stable layer caching.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/api/package.json    packages/api/package.json
COPY packages/web/package.json    packages/web/package.json
RUN npm ci

# Prisma client (incl. the musl engine — see binaryTargets in schema.prisma).
COPY prisma ./prisma
RUN npx prisma generate --schema=prisma/schema.prisma

# Compile the shared scoring engine, then the API (which imports it).
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/api    packages/api
RUN npm run build:shared && npm run build:api

# ---- Stage 2: runner (minimal, non-root) ------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
RUN addgroup -S app && adduser -S app -G app

# node_modules carries the generated Prisma client + musl engine from the builder.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/package.json ./packages/api/package.json
COPY prisma ./prisma

USER app
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "packages/api/dist/index.js"]
