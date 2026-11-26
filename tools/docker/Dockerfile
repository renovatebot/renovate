# syntax=docker/dockerfile:1.29.0@sha256:572cebbc2b15e6f84c077742952674889cb63cd5e9b80abdffcbe587b6f19183

ARG BASE_IMAGE_TYPE=slim

# --------------------------------------
# slim image
# --------------------------------------
FROM ghcr.io/renovatebot/base-image:14.0.2@sha256:a232728e53cb2e777e83882405aff61c7e7289dfffd642289ece6e50a6a2665f AS slim-base

# --------------------------------------
# full image
# --------------------------------------
FROM ghcr.io/renovatebot/base-image:14.0.2-full@sha256:ab704b22ea0eb3a4ff1ef81ff408419694e95cf1debeed3b73e5f9c8b36d3ce1 AS full-base

ENV RENOVATE_BINARY_SOURCE=global

# --------------------------------------
# build image
# --------------------------------------
FROM --platform=$BUILDPLATFORM ghcr.io/renovatebot/base-image:14.0.2@sha256:a232728e53cb2e777e83882405aff61c7e7289dfffd642289ece6e50a6a2665f AS build

# We want a specific node version here
# renovate: datasource=github-releases packageName=containerbase/node-prebuild versioning=node
RUN install-tool node 26.13.1

# corepack is too buggy 😞
# renovate: datasource=npm
RUN install-tool pnpm 11.28.13

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
ENV CI=1 pnpm_config_modules_cache_max_age=0 \
  pnpm_config_loglevel=info

# replace `amd64` with `x64` for `node`
ENV ARCH=${TARGETARCH/amd64/x64}
# set `npm_config_arch` for `prebuild-install`
# set `npm_config_platform_arch` for `install-artifact-from-github`
ENV npm_config_arch=${ARCH} npm_config_platform_arch=${ARCH}

COPY --link patches ./patches
COPY --link pnpm-lock.yaml ./
COPY --link pnpm-workspace.yaml ./

# only fetch deps from lockfile https://pnpm.io/cli/fetch
RUN set -ex; \
  pnpm fetch --prod --ignore-scripts; \
  true

COPY --link . ./

# install npm packages
RUN set -ex; \
  pnpm install --prod --offline --ignore-scripts; \
  pnpm rebuild re2; \
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
  node -e "new require('re2')('.*').exec('test')"; \
  true

LABEL \
  org.opencontainers.image.version="${RENOVATE_VERSION}" \
  org.label-schema.version="${RENOVATE_VERSION}"

# Numeric user ID for the ubuntu user. Used to indicate a non-root user to OpenShift
USER 12021
