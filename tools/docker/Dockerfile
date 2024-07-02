ARG BASE_IMAGE_TYPE=slim

# --------------------------------------
# slim image
# --------------------------------------
FROM ghcr.io/renovatebot/base-image:2.18.4@sha256:e5e8acb4884b05247bb57e74cc1d22d1780a8cbb2b9da8ee2ffe73be7859db44 AS slim-base

# --------------------------------------
# full image
# --------------------------------------
FROM ghcr.io/renovatebot/base-image:2.18.4-full@sha256:deac8587531b7e54d357ad6eb2e4ee0fd31f05dd716c27506ec2ccabe1e91283 AS full-base

# --------------------------------------
# build image
# --------------------------------------
FROM slim-base as build

WORKDIR /usr/local/renovate

ENV CI=1 npm_config_modules_cache_max_age=0

COPY pnpm-lock.yaml ./

# only fetch deps from lockfile https://pnpm.io/cli/fetch
RUN corepack pnpm fetch --prod

COPY . ./

# install
RUN set -ex; \
  corepack pnpm install --prod --offline --ignore-scripts; \
  true

# test
COPY tools/docker/bin/ /usr/local/bin/
RUN set -ex; \
  renovate --version; \
  renovate-config-validator; \
  node -e "new require('re2')('.*').exec('test')"; \
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

ENV RENOVATE_X_IGNORE_NODE_WARN=true

COPY tools/docker/bin/ /usr/local/sbin/
ENTRYPOINT ["/usr/local/sbin/renovate-entrypoint.sh"]
CMD ["renovate"]

ARG RENOVATE_VERSION

COPY --from=build --chown=root:root /usr/local/renovate/ /usr/local/renovate/

RUN set -ex; \
  renovate --version; \
  renovate-config-validator; \
  cd /usr/local/renovate && node -e "new require('re2')('.*').exec('test')"; \
  true

LABEL \
  org.opencontainers.image.version="${RENOVATE_VERSION}" \
  org.label-schema.version="${RENOVATE_VERSION}"

# Numeric user ID for the ubuntu user. Used to indicate a non-root user to OpenShift
USER 1000
