FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.118.0-12@sha256:1e79ffcb45dfa838721d2697c5f8704090fe24879d9e6535a804cdef254b5ca7

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
