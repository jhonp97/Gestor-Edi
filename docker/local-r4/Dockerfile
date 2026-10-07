# Parent must supply a reviewed node:22.x.y-bookworm-slim@sha256:<child digest>.
# There is deliberately no mutable default. Build context is exactly this file,
# a public-only package.json and its reviewed package-lock.json, never the repo.
ARG NODE_IMAGE
FROM ${NODE_IMAGE}
WORKDIR /opt/r4
COPY package.json package-lock.json ./
# Lock validation precedes install. Reject git/file/http dependency transports;
# only the public npm registry is permitted. No application package is copied.
RUN node --input-type=module -e '\
  import fs from "node:fs"; \
  const p = JSON.parse(fs.readFileSync("package.json")); \
  const l = JSON.parse(fs.readFileSync("package-lock.json")); \
  if (JSON.stringify(p.dependencies) !== JSON.stringify({prisma:"5.22.0"}) || \
      p.scripts || p.devDependencies || l.lockfileVersion !== 3 || \
      l.packages?.["node_modules/prisma"]?.version !== "5.22.0") process.exit(1); \
  for (const [name, entry] of Object.entries(l.packages ?? {})) { \
    if (!name) continue; \
    if (!name.startsWith("node_modules/") || \
        !/^https:\/\/registry\.npmjs\.org\//.test(entry.resolved ?? "") || \
        !/^sha512-[A-Za-z0-9+/]+=*$/.test(entry.integrity ?? "")) process.exit(1); \
  }'
ENV CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=1 PRISMA_CLI_BINARY_TARGETS=debian-openssl-3.0.x
# Prisma engines download only during this public build, never on the isolated
# runtime network. Lifecycle scripts are not run for arbitrary dependencies.
RUN test -r /usr/lib/x86_64-linux-gnu/libssl.so.3 \
    && npm ci --ignore-scripts --no-audit --no-fund \
    && node -e 'require("@prisma/get-platform").getBinaryTargetForCurrentPlatform().then(p=>{if(p!=="debian-openssl-3.0.x")process.exit(1)})' \
    && node node_modules/@prisma/engines/scripts/postinstall.js \
    && test -x node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x \
    && node node_modules/prisma/build/index.js --version
# Schema/migrations must later be passed by a reviewed runtime adapter, not COPY.
# All runtime writes belong on bounded tmpfs; no VOLUME declarations.
USER node
ENTRYPOINT ["node", "/opt/r4/node_modules/prisma/build/index.js"]
