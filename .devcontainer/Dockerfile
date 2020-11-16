FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.150.0-14@sha256:84e2be37b491c8c43fa3747cd5a4d86e07163de87d28066a84bbc88dbb972deb

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
