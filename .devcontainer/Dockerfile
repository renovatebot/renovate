FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.110.0-12@sha256:34ae46f3e5b7f514921f89d9cb74a8ae064fb4ddb6c200faead3978c03d8d126

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
