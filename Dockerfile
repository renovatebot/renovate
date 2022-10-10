# renovate: datasource=npm depName=renovate versioning=npm
ARG RENOVATE_VERSION=32.229.0

# Base image
#============
FROM renovate/buildpack:6@sha256:0408248ee016ddbb2345a54f54088fecfe30d30c15f96b7a429a395b2139f737 AS base

LABEL name="renovate"
LABEL org.opencontainers.image.source="https://github.com/digitecgalaxus/renovate" \
  org.opencontainers.image.url="https://renovatebot.com" \
  org.opencontainers.image.licenses="AGPL-3.0-only"

# git setup
RUN git config --global user.email 'renovate@whitesourcesoftware.com'
RUN git config --global user.name  'DG Renovate Bot'

# renovate: datasource=node
RUN install-tool node v14.20.1

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

# hardcode node version to renovate
RUN set -ex; \
  NODE_VERSION=$(node -v | cut -c2-); \
  sed -i "1 s:.*:#\!\/opt\/buildpack\/tools\/node\/${NODE_VERSION}\/bin\/node:" "dist/renovate.js"; \
  sed -i "1 s:.*:#\!\/opt\/buildpack\/tools\/node\/${NODE_VERSION}\/bin\/node:" "dist/config-validator.js";

ARG RENOVATE_VERSION
RUN set -ex; \
  yarn version --new-version ${RENOVATE_VERSION}; \
  yarn add -E  renovate@${RENOVATE_VERSION} --production;  \
  node -e "new require('re2')('.*').exec('test')";


# Final image
#============
FROM base as final

# renovate: datasource=docker versioning=docker
RUN install-tool docker 20.10.18

# renovate: datasource=adoptium-java
RUN install-tool java 11.0.16+101

# renovate: datasource=gradle-version versioning=gradle
RUN install-tool gradle 7.5.1

# renovate: datasource=github-releases lookupName=containerbase/erlang-prebuild versioning=docker
RUN install-tool erlang 24.3.4.6

# renovate: datasource=docker versioning=docker
RUN install-tool elixir 1.14.0

# renovate: datasource=github-releases lookupName=containerbase/php-prebuild
RUN install-tool php 7.4.32

# renovate: datasource=github-releases lookupName=composer/composer
RUN install-tool composer 2.4.2

# renovate: datasource=golang-version
RUN install-tool golang 1.19.2

# renovate: datasource=github-releases lookupName=containerbase/python-prebuild
RUN install-tool python 3.10.7

# renovate: datasource=pypi
RUN install-pip pipenv 2022.10.9

# renovate: datasource=github-releases lookupName=python-poetry/poetry
RUN install-tool poetry 1.2.1

# renovate: datasource=pypi
RUN install-pip hashin 0.17.0

# renovate: datasource=pypi
RUN install-pip pip-tools 6.9.0

# renovate: datasource=docker versioning=docker
RUN install-tool rust 1.64.0

# renovate: datasource=github-releases lookupName=containerbase/ruby-prebuild
RUN install-tool ruby 3.1.2

# renovate: datasource=rubygems versioning=ruby
RUN install-gem bundler 2.3.23

# renovate: datasource=rubygems versioning=ruby
RUN install-gem cocoapods 1.11.3

# renovate: datasource=docker lookupName=mcr.microsoft.com/dotnet/sdk
RUN install-tool dotnet 6.0.401

# renovate: datasource=npm versioning=npm
RUN install-tool pnpm 6.34.0

# renovate: datasource=npm versioning=npm
RUN install-npm lerna 4.0.0

# renovate: datasource=github-releases lookupName=helm/helm
RUN install-tool helm v3.10.0

# renovate: datasource=github-releases lookupName=jsonnet-bundler/jsonnet-bundler
RUN install-tool jb v0.5.1

COPY --from=tsbuild /usr/src/app/package.json package.json
COPY --from=tsbuild /usr/src/app/dist dist
COPY --from=tsbuild /usr/src/app/node_modules node_modules

# exec helper
COPY bin/ /usr/local/bin/
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
