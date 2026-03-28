FROM node:22-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build

WORKDIR /app

ARG API_PROXY_TARGET=http://backend:3002
ENV API_PROXY_TARGET=${API_PROXY_TARGET}

COPY . .

RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/.next ./.next
COPY --from=build /app/next.config.ts ./next.config.ts

EXPOSE 3001

CMD ["./node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3001"]
