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

# We want a specific node version here
# renovate: datasource=node-version
RUN install-tool node 20.15.1

WORKDIR /usr/local/renovate

ARG TARGETPLATFORM
ARG BUILDPLATFORM

RUN set -ex; \
  echo "I am running on $BUILDPLATFORM, building for $TARGETPLATFORM"; \
  uname -a; \
  true

# fetch static node binary
# trim `linux/` from TARGETPLATFORM
# replace `amd64` with `x64` for `node`
RUN set -ex; \
  ver=$(node --version); \
  arch=${TARGETPLATFORM:6}; \
  temp_dir="$(mktemp -d)"; \
  curl -fsSL https://nodejs.org/dist/${ver}/node-${ver}-linux-${arch/amd64/x64}.tar.xz -o ${temp_dir}/node.tar.xz; \
  bsdtar --strip 1 -C ${temp_dir} -xf ${temp_dir}/node.tar.xz; \
  cp ${temp_dir}/bin/node ./node; \
  true

# fetch npm packages
ENV CI=1 npm_config_modules_cache_max_age=0 \
  npm_config_loglevel=info

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

# install npm packages
RUN set -ex; \
  corepack pnpm install --prod --offline --ignore-scripts; \
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
  /usr/local/renovate/node -e "new require('re2')('.*').exec('test');new require('better-sqlite3')(':memory:')"; \
  true

LABEL \
  org.opencontainers.image.version="${RENOVATE_VERSION}" \
  org.label-schema.version="${RENOVATE_VERSION}"

# Numeric user ID for the ubuntu user. Used to indicate a non-root user to OpenShift
USER 1000
