FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.128.0-14@sha256:95f36080a8a6ba2df1f24bc1639d89a8f64dc36d6554c78f33b794983ccbee55

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
