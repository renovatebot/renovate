ARG RENOVATE_VERSION
ARG BASE_IMAGE_TYPE=slim

# --------------------------------------
# slim image
# --------------------------------------
FROM ghcr.io/renovatebot/base-image:1.20.1@sha256:b63034bd1f197cde88d809e03b6e8ce88b41d739be5e71d0438fb8dd96618f5a AS slim-base

# --------------------------------------
# full image
# --------------------------------------
FROM ghcr.io/renovatebot/base-image:1.20.1-full@sha256:47e8cd5501cb733c99e6365faaac266c0e955c989dc549bf398d7d4b23ef4969 AS full-base

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

COPY bin/ /usr/local/bin/
CMD ["renovate"]

ARG RENOVATE_VERSION
RUN install-tool renovate

# Compabillity, so `config.js` can access renovate and deps
RUN ln -sf /opt/containerbase/tools/renovate/${RENOVATE_VERSION}/node_modules ./node_modules;

RUN set -ex; \
  renovate --version; \
  renovate-config-validator; \
  node -e "new require('re2')('.*').exec('test')"; \
  true

LABEL \
  org.opencontainers.image.version="${RENOVATE_VERSION}" \
  org.label-schema.version="${RENOVATE_VERSION}"

# Numeric user ID for the ubuntu user. Used to indicate a non-root user to OpenShift
USER 1000
