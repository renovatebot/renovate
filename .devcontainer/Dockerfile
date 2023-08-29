FROM ghcr.io/containerbase/node:18.17.1

USER root

RUN install-apt make g++

# renovate: datasource=github-releases packageName=containerbase/python-prebuild
RUN install-tool python 3.11.5

# renovate: datasource=npm
RUN install-tool corepack 0.19.0

USER ubuntu
