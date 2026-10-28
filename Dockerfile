# Multi-stage Dockerfile for ReliefHub Operations Console
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy full application source
COPY . .

# Build the React frontend production bundle
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy package manifests and install production-only dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built frontend assets and server files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001

CMD ["npx", "tsx", "server/index.ts"]
