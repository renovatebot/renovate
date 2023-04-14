FROM ghcr.io/containerbase/node:18.16.0@sha256:fc48ac97eb5d0dee207d4a336a52d7d3be68e1adec01cc1d13a1c12fab80a265

USER root

WORKDIR /workspace
COPY . .

RUN apt update; \
    apt install -y make g++

# renovate: datasource=github-releases packageName=containerbase/python-prebuild
RUN install-tool python 3.11.3

# renovate: datasource=npm
RUN install-tool yarn 1.22.19
RUN yarn install
