# Stage 1: Build web frontend
FROM node:22-slim AS web-builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/ shared/
COPY web/ web/
COPY server/package.json server/
COPY cli/package.json cli/
RUN npm ci --workspace=web --workspace=shared
RUN npm run build -w web

# Stage 2: Production server
FROM node:22-slim
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/ shared/
COPY server/ server/
COPY cli/package.json cli/
RUN npm ci --workspace=server --workspace=shared --omit=dev || npm ci
COPY --from=web-builder /app/web/dist web/dist
COPY start-with-env.js ./

EXPOSE 3100
ENV VISOR_HOST=0.0.0.0
ENV VISOR_PORT=3100

CMD ["node", "--experimental-strip-types", "server/src/index.ts"]
