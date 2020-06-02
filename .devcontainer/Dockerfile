FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.119.0-12@sha256:b46a520a09888b34fce28aa75e58a537a82cc6b086170d279e7ecd1d0a8b4262

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
