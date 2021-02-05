FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.157.0-14@sha256:986f89df94f35f4e0b769a77c790c5f662cce407a0749c674654bbb1e4060b71

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing Renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
