# ===== Build stage =====
FROM node:20-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json* ./
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/web/package.json ./apps/web/

# `npm ci` é reprodutível (respeita o lockfile) — hardening S3.
RUN npm ci

COPY tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY apps/web ./apps/web

RUN npm run build -w packages/contracts \
  && npm run build -w apps/web

# ===== Runtime stage =====
FROM node:20-alpine AS runtime
WORKDIR /repo/apps/web
ENV NODE_ENV=production

COPY --from=build /repo/node_modules /repo/node_modules
COPY --from=build /repo/packages/contracts /repo/packages/contracts
COPY --from=build /repo/apps/web/.next ./.next
COPY --from=build /repo/apps/web/public ./public
COPY --from=build /repo/apps/web/package.json ./package.json
COPY --from=build /repo/apps/web/next.config.mjs ./next.config.mjs

# Não roda como root (hardening S3).
USER node

EXPOSE 3000
CMD ["npm", "run", "start"]
