FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.149.0-14@sha256:7ed76ef32b22aa80680443e77ca993008f4e464cac9226a678f97b16cfa2e75c

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
