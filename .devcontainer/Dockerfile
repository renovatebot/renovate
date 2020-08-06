FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.132.0-14@sha256:9397fae70bb33376f850944c5744dc1846ab0e543338fc2fe9311f471c96729d

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
