# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /build

COPY apps/api/package.json apps/api/tsconfig.json apps/api/tsconfig.build.json ./
RUN npm install --ignore-scripts

COPY apps/api/prisma ./prisma
RUN npx prisma generate

COPY apps/api/src ./src
RUN npx tsc -p tsconfig.build.json

# ── Stage 2: Production ────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

RUN apk add --no-cache tini
ENV NODE_ENV=production

COPY --from=builder /build/package.json ./
RUN npm install --omit=dev --ignore-scripts

COPY --from=builder /build/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /build/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /build/dist ./dist
COPY apps/api/prisma ./prisma

RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/src/main.js"]
