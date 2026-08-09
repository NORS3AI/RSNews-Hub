# RS News Hub — production image (Next.js standalone).
# Works on any container host (Render, Fly.io, Railway, a VPS, etc.).
# Vercel does NOT need this. See DEPLOYMENT.md.

# 1) Install deps
FROM node:22-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# 2) Build (needs the schema for `prisma generate`, run in the build script)
FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# A dummy URL so `next build` can import Prisma without a live DB; the real
# DATABASE_URL is injected at runtime.
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 3) Runtime — minimal standalone server
FROM node:22-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Standalone bundle + static assets + public files + Prisma engine/schema.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
# Apply migrations, then start. (Move `migrate deploy` to a release step if your
# host runs one, so a rolling deploy doesn't migrate from every instance.)
CMD ["sh", "-c", "npx --no-install prisma migrate deploy && node server.js"]
