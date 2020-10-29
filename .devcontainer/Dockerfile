FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.147.0-14@sha256:d369a44fd5239a4ffde1184d401fe14960423b5984d50686af932e014b719350

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
