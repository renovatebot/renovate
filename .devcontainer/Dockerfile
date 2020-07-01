FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.124.0-14@sha256:2823a5984f54b49b7b975d3ec74d912dcb03e11cc6575c7fe7195b04c5015f3d

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
