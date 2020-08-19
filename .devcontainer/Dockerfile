FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.136.0-14@sha256:ebf5dd3b52779654d0a408a6d80c856bf03c30b2b9ff491f2207bacd5c110af3

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
