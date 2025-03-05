# syntax=docker/dockerfile:1.14.0@sha256:0232be24407cc42c983b9b269b1534a3b98eea312aad9464dd0f1a9e547e15a7

ARG BASE_IMAGE_TYPE=slim

# --------------------------------------
# slim image
# --------------------------------------
FROM ghcr.io/renovatebot/base-image:9.46.6@sha256:17305628403bbe797fea67a326cd471f502dbbb493bb782bc055d4a2e8042177 AS slim-base

# --------------------------------------
# full image
# --------------------------------------
FROM ghcr.io/renovatebot/base-image:9.46.6-full@sha256:e455471af7086a302c87193b4be8a47d0bb2b244d5872b939effc37232df7fdb AS full-base

ENV RENOVATE_BINARY_SOURCE=global

# --------------------------------------
# build image
# --------------------------------------
FROM --platform=$BUILDPLATFORM ghcr.io/renovatebot/base-image:9.46.6@sha256:17305628403bbe797fea67a326cd471f502dbbb493bb782bc055d4a2e8042177 AS build

# We want a specific node version here
# renovate: datasource=github-releases packageName=containerbase/node-prebuild versioning=node
RUN install-tool node 22.14.0

# corepack is too buggy 😞
# renovate: datasource=npm
RUN install-tool pnpm 10.5.1

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
RUN set -ex; \
  pnpm install --prod --offline --ignore-scripts; \
  pnpm rebuild re2 better-sqlite3; \
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

# make our node binary available as last in path
RUN ln -sf /usr/local/renovate/node /bin/node

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
