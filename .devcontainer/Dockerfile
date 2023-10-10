FROM ghcr.io/containerbase/node:18.18.0

USER root

RUN install-apt make g++

# renovate: datasource=github-releases packageName=containerbase/python-prebuild
RUN install-tool python 3.12.0

# renovate: datasource=npm
RUN install-tool corepack 0.20.0

USER ubuntu
