FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.117.1-12@sha256:620227454fee7f57119d21972eb63b5352718319cc5db4fbc7cdae25e98d6f1c

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
