# ----------------------------------------------------
# 1. Base image
# ----------------------------------------------------
FROM oven/bun:1-alpine AS base
WORKDIR /app

# ----------------------------------------------------
# 2. Builder stage
# ----------------------------------------------------
FROM base AS builder
WORKDIR /app

COPY package.json bun.lock* ./
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN bun install --frozen-lockfile

# Dummy URL just so Prisma stops crying during generate
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public"

# Generate Prisma Client
RUN bunx prisma generate

# ----------------------------------------------------
# 3. Production Runner stage
# ----------------------------------------------------
FROM base AS runner
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/generated ./generated

COPY package.json bun.lock* ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig.json ./
COPY src ./src

EXPOSE 4000

CMD ["bun", "run", "start"]