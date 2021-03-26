FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.157.0-14@sha256:986f89df94f35f4e0b769a77c790c5f662cce407a0749c674654bbb1e4060b71

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing Renovate dev tools

# Renovate requires Git version 2.22+, while Debian Buster only ships version 2.20.
# The backports repository contains newer versions of Git, which we'll use instead.
RUN echo 'deb http://deb.debian.org/debian buster-backports main' > /etc/apt/sources.list.d/backports.list \
   && DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends build-essential git/buster-backports \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
