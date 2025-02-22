# syntax=docker/dockerfile:1.14.0@sha256:0232be24407cc42c983b9b269b1534a3b98eea312aad9464dd0f1a9e547e15a7

ARG BASE_IMAGE_TYPE=slim

# --------------------------------------
# slim image
# --------------------------------------
FROM ghcr.io/renovatebot/base-image:9.42.0@sha256:9b96e4d14dc576a963873eda23abf0580df48cde0fa364efd3d37e8dee5d8b18 AS slim-base

# --------------------------------------
# full image
# --------------------------------------
FROM ghcr.io/renovatebot/base-image:9.42.0-full@sha256:9ac037ffcaa31a457c97c61edeef32c55bfa9b78ce050a4fac97fba03d97ac8c AS full-base

ENV RENOVATE_BINARY_SOURCE=global

# --------------------------------------
# build image
# --------------------------------------
FROM --platform=$BUILDPLATFORM ghcr.io/renovatebot/base-image:9.42.0@sha256:9b96e4d14dc576a963873eda23abf0580df48cde0fa364efd3d37e8dee5d8b18 AS build

# We want a specific node version here
# renovate: datasource=github-releases packageName=containerbase/node-prebuild versioning=node
RUN install-tool node 22.14.0

# corepack is too buggy 😞
# renovate: datasource=npm
RUN install-tool pnpm 10.4.0

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

COPY --link pnpm-lock.yaml ./

# only fetch deps from lockfile https://pnpm.io/cli/fetch
RUN set -ex; \
  pnpm fetch --prod --ignore-scripts; \
  true

COPY --link . ./

# disable prepare script
RUN sed -i -e "s/run-s 'prepare:\*'/true/" package.json

# install npm packages
RUN set -ex; \
  pnpm install --prod --offline; \
  pnpm rebuild; \
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
