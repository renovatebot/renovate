FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.123.0-14@sha256:1d085a0df6b7c39046348a5c5ac3f2a6ba3f9536ff81cc9741b748764441c5cd

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
