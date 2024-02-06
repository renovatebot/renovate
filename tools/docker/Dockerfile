ARG RENOVATE_VERSION
ARG BASE_IMAGE_TYPE=slim

# --------------------------------------
# slim image
# --------------------------------------
FROM ghcr.io/renovatebot/base-image:1.20.6@sha256:279d1aa081dbd9dc5b0630ce1347edf233fd6f14d747547eac36053b2ab7f9bd AS slim-base

# --------------------------------------
# full image
# --------------------------------------
FROM ghcr.io/renovatebot/base-image:1.20.5-full@sha256:a158def3ab8b1b4785cdda195c11986af7c7b7d7d99d0b2c8677301ab0252d3b AS full-base

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
