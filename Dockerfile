# renovate: datasource=npm depName=renovate versioning=npm
ARG RENOVATE_VERSION=32.131.2

# Base image
#============
FROM renovate/buildpack:6@sha256:7df4265ac86591f6909e9e2c73b4e32e9fe06e5b89405cea1addfc213bc94aef AS base

LABEL name="renovate"
LABEL org.opencontainers.image.source="https://github.com/digitecgalaxus/renovate" \
  org.opencontainers.image.url="https://renovatebot.com" \
  org.opencontainers.image.licenses="AGPL-3.0-only"

# git setup
RUN git config --global user.email 'renovate@whitesourcesoftware.com'
RUN git config --global user.name  'DG Renovate Bot'

# renovate: datasource=node
RUN install-tool node v14.20.0

# renovate: datasource=npm versioning=npm
RUN install-tool yarn 1.22.19

WORKDIR /usr/src/app

# Build image
#============
FROM base as tsbuild

COPY . .

RUN set -ex; \
  yarn install; \
  yarn build; \
  chmod +x dist/*.js;

ARG RENOVATE_VERSION
RUN set -ex; \
  yarn version --new-version ${RENOVATE_VERSION}; \
  yarn add -E  renovate@${RENOVATE_VERSION} --production;  \
  node -e "new require('re2')('.*').exec('test')";


# Final image
#============
FROM base as final

# renovate: datasource=docker lookupName=mcr.microsoft.com/dotnet/sdk
RUN install-tool dotnet 6.0.302

# renovate: datasource=github-releases lookupName=helm/helm
RUN install-tool helm v3.9.2

# renovate: datasource=docker versioning=docker
RUN install-tool golang 1.18.4

COPY --from=tsbuild /usr/src/app/package.json package.json
COPY --from=tsbuild /usr/src/app/dist dist
COPY --from=tsbuild /usr/src/app/node_modules node_modules

# exec helper
COPY tools/ /usr/local/bin/
RUN ln -sf /usr/src/app/dist/renovate.js /usr/local/bin/renovate;
RUN ln -sf /usr/src/app/dist/config-validator.js /usr/local/bin/renovate-config-validator;
CMD ["renovate"]

RUN set -ex; \
  renovate --version; \
  renovate-config-validator; \
  node -e "new require('re2')('.*').exec('test')";

ARG RENOVATE_VERSION
LABEL org.opencontainers.image.version="${RENOVATE_VERSION}"

# Numeric user ID for the ubuntu user. Used to indicate a non-root user to OpenShift
USER 1000
