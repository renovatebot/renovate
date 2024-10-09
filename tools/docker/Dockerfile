# syntax=docker/dockerfile:1.10.0@sha256:865e5dd094beca432e8c0a1d5e1c465db5f998dca4e439981029b3b81fb39ed5

ARG BASE_IMAGE_TYPE=slim

# --------------------------------------
# slim image
# --------------------------------------
FROM ghcr.io/renovatebot/base-image:7.34.2@sha256:88f99b7a9cda82b9eb21a1e41d218b1e026bbf8fa3d930288dceb87551384881 AS slim-base

# --------------------------------------
# full image
# --------------------------------------
FROM ghcr.io/renovatebot/base-image:7.34.2-full@sha256:3fd12915d4bb70d81da8b87a09aa32fa794d52223ae76fa704eab7eaeb9c40b6 AS full-base

# --------------------------------------
# build image
# --------------------------------------
FROM --platform=$BUILDPLATFORM ghcr.io/renovatebot/base-image:7.34.2@sha256:88f99b7a9cda82b9eb21a1e41d218b1e026bbf8fa3d930288dceb87551384881 AS build

# We want a specific node version here
# renovate: datasource=node-version
RUN install-tool node 20.18.0

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

# fetch npm packages
ENV CI=1 npm_config_modules_cache_max_age=0 \
  npm_config_loglevel=info


# replace `amd64` with `x64` for `node`
ENV ARCH=${TARGETARCH/amd64/x64}

COPY --link pnpm-lock.yaml ./

# set `npm_config_arch` for `prebuild-install`
# set `npm_config_platform_arch` for `install-artifact-from-github`
# only fetch deps from lockfile https://pnpm.io/cli/fetch
RUN set -ex; \
  export npm_config_arch=${ARCH} npm_config_platform_arch=${ARCH}; \
  corepack pnpm fetch --prod; \
  true

COPY --link . ./

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

COPY tools/docker/bin/ /usr/local/sbin/
ENTRYPOINT ["/usr/local/sbin/renovate-entrypoint.sh"]
CMD ["renovate"]

ARG RENOVATE_VERSION

COPY --link --from=build --chown=root:root /usr/local/renovate/ /usr/local/renovate/

# test
RUN set -ex; \
  renovate --version; \
  pushd /usr/local/renovate/; \
  ./node -e "new require('re2')('.*').exec('test');new require('better-sqlite3')(':memory:')"; \
  true

LABEL \
  org.opencontainers.image.version="${RENOVATE_VERSION}" \
  org.label-schema.version="${RENOVATE_VERSION}"

# Numeric user ID for the ubuntu user. Used to indicate a non-root user to OpenShift
USER 1000
