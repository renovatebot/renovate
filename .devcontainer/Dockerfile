FROM ghcr.io/containerbase/node:18.16.0

USER root

RUN install-apt make g++

# renovate: datasource=github-releases packageName=containerbase/python-prebuild
RUN install-tool python 3.11.3

# renovate: datasource=npm
RUN install-tool yarn 1.22.19
