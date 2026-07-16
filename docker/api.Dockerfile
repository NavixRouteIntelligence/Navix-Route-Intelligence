# ===== Build stage =====
FROM node:20-alpine AS build
WORKDIR /repo

# Copia manifestos para aproveitar cache de instalação
COPY package.json package-lock.json* ./
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/api/package.json ./apps/api/

# `npm ci` é reprodutível (respeita o lockfile) — hardening S3.
RUN npm ci

# Copia o código e builda contracts + api
COPY tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY apps/api ./apps/api

RUN npm run build -w packages/contracts \
  && npm run build -w apps/api

# ===== Runtime stage =====
FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/contracts ./packages/contracts
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/apps/api/dist ./apps/api/dist

# Não roda como root (hardening S3): a imagem node:alpine já traz o usuário `node`.
USER node

EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
