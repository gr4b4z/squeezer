# Single image: the gateway serves the API, the WebSocket and the built SPA.
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/gateway/package.json apps/gateway/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3001 TRUST_PROXY=true
COPY --from=build /app /app
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1
CMD ["node_modules/.bin/tsx", "apps/gateway/src/index.ts"]
