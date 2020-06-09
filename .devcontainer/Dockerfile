FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.122.1-14@sha256:3b67297f5c032d61899a54fcf22b2f53adc7a085a35540f0a698332b1a072832

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
