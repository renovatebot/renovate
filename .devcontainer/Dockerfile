FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.146.0-14@sha256:77344ff4569646b2c74757307847aae3d3b24e409642c6c3890d097bdd3beb58

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
