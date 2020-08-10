FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.134.0-14@sha256:aef4b7bcb9cf8ad422bd59647d0ad683833d2a148cc84c00516836941af5431d

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
