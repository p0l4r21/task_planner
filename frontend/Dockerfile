# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# Serve stage — static files served by Caddy (copied in docker-compose)
FROM alpine:3.20
COPY --from=build /app/dist /srv
