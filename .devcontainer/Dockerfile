FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.143.0-14@sha256:25a4b9b442a3e90aaf8f83b781c80a6eee23eecdb205ba7bcb6b442f35c32774

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
