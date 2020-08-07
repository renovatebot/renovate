FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.133.0-14@sha256:b9f8c9675003b77a01a0a60857dec860a6798f551b2a8e066fdba7d07b56ffe7

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
