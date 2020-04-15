FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.114.0-12@sha256:f3f889367e11999bbb1ceaa3c60756810f9f19e11872e469b1994878339fba61

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
