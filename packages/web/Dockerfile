# syntax=docker/dockerfile:1

# ---- Stage 1: builder (vite build) ------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/api/package.json    packages/api/package.json
COPY packages/web/package.json    packages/web/package.json
RUN npm ci

COPY tsconfig.base.json ./
# The web build inlines the scoring engine straight from shared/src (see the
# vite alias), so no separate shared build step is needed here.
COPY packages/shared packages/shared
COPY packages/web    packages/web

# Relative /api by default so the same image works anywhere (nginx proxies it).
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build:web
RUN echo "ok" > packages/web/dist/health.txt

# ---- Stage 2: runner (nginx) ------------------------------------------------
FROM nginx:alpine AS runner
# Templated so the API upstream differs per environment without a rebuild.
#   docker-compose: api:3000   |   k8s: tarot-api:3000
ENV API_UPSTREAM=tarot-api:3000
COPY packages/web/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1/health.txt || exit 1
