FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.152.1-14@sha256:f99c0b5db1fe54f6e441876d00b6cab598038a2d03aab77b3353a1960e40dc06

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing Renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
