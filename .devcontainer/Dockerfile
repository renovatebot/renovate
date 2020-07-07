FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.127.0-14@sha256:214468ea79080bebb30d4a63836807db5d44c545532603042a371c4762554c7e

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
