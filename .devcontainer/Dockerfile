FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.137.0-14@sha256:05daf0625e38d1bdd321f6125f44cc0985da8a4219282eb68037e3199f0e6e68

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
