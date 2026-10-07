# Proposal pins public versions; availability/build interoperability need the reviewed execution epoch.
FROM node:22.22.2-bookworm-slim AS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@9.15.9
WORKDIR /app
COPY --chmod=0644 package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
# Only explicitly necessary public lifecycle steps. bcryptjs needs no native compilation;
# Sharp/SWC/Tailwind use locked Linux optional binaries, not host Windows artifacts.
RUN pnpm rebuild @prisma/engines esbuild
COPY --chmod=0644 prisma/schema.prisma prisma/schema.prisma
RUN DATABASE_URL=postgresql://build-only@127.0.0.1:1/unavailable \
    DIRECT_URL=postgresql://build-only@127.0.0.1:1/unavailable \
    node node_modules/prisma/build/index.js generate --schema prisma/schema.prisma

FROM dependencies AS build
# This context has already been explicitly inventoried by the runner, not dockerignore-filtered.
COPY src ./src
COPY public ./public
COPY tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs ./
ENV NEXT_TELEMETRY_DISABLED=1
# next-pwa installs a Webpack plugin. Use Next 16's explicit supported Webpack build.
# No database or app secrets are supplied here. Google font downloads are build-only.
RUN node node_modules/next/dist/bin/next build --webpack

FROM dependencies AS app
ARG STAGING_OWNER
LABEL io.gestor-edi.local-staging=$STAGING_OWNER
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOME=/tmp
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/next.config.ts ./next.config.ts
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]

FROM app AS browser
USER root
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/chromium
RUN node node_modules/@playwright/test/cli.js install --with-deps chromium \
    && chmod -R a+rX /opt/chromium && rm -rf /var/lib/apt/lists/*
COPY --chown=node:node playwright.staging.config.ts ./playwright.staging.config.ts
COPY --chown=node:node scripts/run-local-staging.mjs ./scripts/run-local-staging.mjs
COPY --chown=node:node tests/e2e/truck-workday-staging.spec.ts ./tests/e2e/truck-workday-staging.spec.ts
USER node
CMD ["node", "node_modules/@playwright/test/cli.js", "test", "--config", "playwright.staging.config.ts"]
