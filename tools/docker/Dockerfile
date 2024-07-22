ARG BASE_IMAGE_TYPE=slim

# --------------------------------------
# slim image
# --------------------------------------
FROM ghcr.io/renovatebot/base-image:2.28.0@sha256:0abd37cc5818199aad69b226537fade5047bae1ca1a987f855453d9eed19a795 AS slim-base

# --------------------------------------
# full image
# --------------------------------------
FROM ghcr.io/renovatebot/base-image:2.28.0-full@sha256:0e3a859452ece1442faa693c71f02481bb7a3c8addbc704b24dcafa9bcfb4fd8 AS full-base

# --------------------------------------
# build image
# --------------------------------------
FROM --platform=$BUILDPLATFORM ghcr.io/renovatebot/base-image:2.28.0@sha256:0abd37cc5818199aad69b226537fade5047bae1ca1a987f855453d9eed19a795 AS build

ARG TARGETPLATFORM
ARG BUILDPLATFORM

RUN set -ex; \
  echo "I am running on $BUILDPLATFORM, building for $TARGETPLATFORM"; \
  uname -a; \
  true

WORKDIR /usr/local/renovate

ENV CI=1 npm_config_modules_cache_max_age=0 \
  npm_config_loglevel=info \
  ARCH=arm64

COPY pnpm-lock.yaml ./

# trim `linux/` from TARGETPLATFORM
# replace `amd64` with `x64` for `node`
# set `npm_config_arch` for `prebuild-install`
# set `npm_config_platform_arch` for `install-artifact-from-github`
# only fetch deps from lockfile https://pnpm.io/cli/fetch
RUN set -ex; \
  arch=${TARGETPLATFORM:6}; \
  export npm_config_arch=${arch/amd64/x64} npm_config_platform_arch=${arch/amd64/x64}; \
  corepack pnpm fetch --prod; \
  true

COPY . ./

# install
RUN set -ex; \
  corepack pnpm install --prod --offline --ignore-scripts; \
  true

# test
COPY tools/docker/bin/ /usr/local/bin/
# RE2 doesn't work on cross compile
ENV RENOVATE_X_IGNORE_RE2=true
RUN set -ex; \
  renovate --version; \
  renovate-config-validator; \
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

COPY tools/docker/bin/ /usr/local/bin/
CMD ["renovate"]

ARG RENOVATE_VERSION

COPY --from=build --chown=root:root /usr/local/renovate/ /usr/local/renovate/

# Compabillity, so `config.js` can access renovate and deps
RUN set -ex; \
  mkdir /opt/containerbase/tools/renovate; \
  echo "${RENOVATE_VERSION}" > /opt/containerbase/versions/renovate; \
  ln -sf /usr/local/renovate /opt/containerbase/tools/renovate/${RENOVATE_VERSION}; \
  ln -sf /usr/local/renovate/node_modules ./node_modules; \
  true

RUN set -ex; \
  renovate --version; \
  node -e "new require('re2')('.*').exec('test');new require('better-sqlite3')(':memory:')"; \
  true

LABEL \
  org.opencontainers.image.version="${RENOVATE_VERSION}" \
  org.label-schema.version="${RENOVATE_VERSION}"

# Numeric user ID for the ubuntu user. Used to indicate a non-root user to OpenShift
USER 1000
