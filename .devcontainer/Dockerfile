FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.140.0-14@sha256:41354b8ee9c2b7efbd41e1136f88c5f019291976d78eab4e49e25c277bb742ff

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
