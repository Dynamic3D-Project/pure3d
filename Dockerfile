FROM oven/bun:1 AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

ARG APP_BASE_PATH=
ARG PUBLIC_POCKETBASE_URL=http://localhost:8090
ARG PUBLIC_ASSET_BASE_URL=

ENV APP_BASE_PATH=${APP_BASE_PATH}
ENV PUBLIC_POCKETBASE_URL=${PUBLIC_POCKETBASE_URL}
ENV PUBLIC_ASSET_BASE_URL=${PUBLIC_ASSET_BASE_URL}

RUN bun run build

FROM nginx:1.27-alpine AS runtime

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
