# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# Serve stage — Caddy with SPA fallback
FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY Caddyfile.container /etc/caddy/Caddyfile
