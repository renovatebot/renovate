# syntax=docker/dockerfile:1.16.0@sha256:e2dd261f92e4b763d789984f6eab84be66ab4f5f08052316d8eb8f173593acf7

ARG BASE_IMAGE_TYPE=slim

# --------------------------------------
# slim image
# --------------------------------------
FROM ghcr.io/renovatebot/base-image:9.71.5@sha256:b620bcc9a4a98dd26ed78a5708c61b522669fa7ce8966193c657eca3a0858e36 AS slim-base

# --------------------------------------
# full image
# --------------------------------------
FROM ghcr.io/renovatebot/base-image:9.71.5-full@sha256:e043385c0328f8e9949241aafbbc8ed6a3ff3c45a2d08d9ecd9a62310f5edacf AS full-base

ENV RENOVATE_BINARY_SOURCE=global

# --------------------------------------
# build image
# --------------------------------------
FROM --platform=$BUILDPLATFORM ghcr.io/renovatebot/base-image:9.71.5@sha256:b620bcc9a4a98dd26ed78a5708c61b522669fa7ce8966193c657eca3a0858e36 AS build

# We want a specific node version here
# renovate: datasource=github-releases packageName=containerbase/node-prebuild versioning=node
RUN install-tool node 22.16.0

# corepack is too buggy 😞
# renovate: datasource=npm
RUN install-tool pnpm 10.11.0

WORKDIR /usr/local/renovate

ARG TARGETPLATFORM
ARG TARGETARCH
ARG BUILDPLATFORM

RUN set -ex; \
  echo "I am running on $BUILDPLATFORM, building for $TARGETPLATFORM"; \
  uname -a; \
  true

# replace `amd64` with `x86_64` for `node`
ENV ARCH=${TARGETARCH/amd64/x86_64}
ENV ARCH=${ARCH/arm64/aarch64}

# fetch static node binary
RUN set -ex; \
  ver=$(node --version); ver=${ver:1} \
  temp_dir="$(mktemp -d)"; \
  curl -fsSL "https://github.com/containerbase/node-prebuild/releases/download/${ver}/node-${ver}-${ARCH}.tar.xz" -o ${temp_dir}/node.tar.xz; \
  bsdtar --strip 1 -C ${temp_dir} -xf ${temp_dir}/node.tar.xz; \
  cp ${temp_dir}/bin/node ./node; \
  true

# prepare pnpm env
ENV CI=1 npm_config_modules_cache_max_age=0 \
  npm_config_loglevel=info

# replace `amd64` with `x64` for `node`
ENV ARCH=${TARGETARCH/amd64/x64}
# set `npm_config_arch` for `prebuild-install`
# set `npm_config_platform_arch` for `install-artifact-from-github`
ENV npm_config_arch=${ARCH} npm_config_platform_arch=${ARCH}

COPY --link .npmrc ./
COPY --link patches ./patches
COPY --link pnpm-lock.yaml ./

# only fetch deps from lockfile https://pnpm.io/cli/fetch
RUN set -ex; \
  pnpm fetch --prod --ignore-scripts; \
  true

COPY --link . ./

# install npm packages
ARG CACHEBUST=1
RUN echo "Cache bust: $CACHEBUST"; \
  rm -rf node_modules .pnpm; \
  ln -sf /usr/local/renovate/node /usr/local/bin/node; \
  ln -sf /usr/local/renovate/node /bin/node; \
  pnpm install --prod --offline; \
  find node_modules/.pnpm/node-expat@*/node_modules/node-expat/build -type f -name 'node_expat.node' -delete; \
  pnpm rebuild re2 better-sqlite3 node-expat; \
  true

# --------------------------------------
# final image
# --------------------------------------
FROM ${BASE_IMAGE_TYPE}-base

LABEL name="renovate"
LABEL org.opencontainers.image.source="https://github.com/renovatebot/renovate" \
  org.opencontainers.image.url="https://renovatebot.com" \
  org.opencontainers.image.licenses="AGPL-3.0-only"

WORKDIR /usr/src/app

COPY tools/docker/bin/ /usr/local/sbin/
ENTRYPOINT ["/usr/local/sbin/renovate-entrypoint.sh"]
CMD ["renovate"]

ARG RENOVATE_VERSION

COPY --link --from=build --chown=root:root /usr/local/renovate/ /usr/local/renovate/

# Copy pnpm binary from build stage to final image
COPY --from=build /usr/local/bin/pnpm /usr/local/bin/pnpm
COPY --from=build /opt/containerbase/tools/pnpm /opt/containerbase/tools/pnpm
COPY --from=build /usr/local/bin/npm /usr/local/bin/npm

# Ensure both /bin/node and /usr/local/bin/node point to the custom Node.js binary
RUN ln -sf /usr/local/renovate/node /bin/node && ln -sf /usr/local/renovate/node /usr/local/bin/node

# Switch to non-root user for native module rebuild
USER 12021
RUN cd /usr/local/renovate && pnpm rebuild re2 better-sqlite3 node-expat

# Switch back to root for any further setup
USER root
RUN chown -R 12021:12021 /usr/local/renovate

# Debug: list all node_expat.node files
RUN find /usr/local/renovate -name node_expat.node -ls

# ensure default base and cache directories exist.
# /runner/cache is an alternative cache directory used in both Docker and microVMs.
RUN mkdir -p /tmp/renovate/cache/renovate/repository /runner/cache/renovate/repository && \
  chmod -R 777 /tmp/renovate /runner

# test
RUN set -ex; \
  renovate --version; \
  pushd /usr/local/renovate/; \
  node -e "new require('re2')('.*').exec('test');new require('better-sqlite3')(':memory:')"; \
  true

LABEL \
  org.opencontainers.image.version="${RENOVATE_VERSION}" \
  org.label-schema.version="${RENOVATE_VERSION}"

# Numeric user ID for the ubuntu user. Used to indicate a non-root user to OpenShift
USER 12021
