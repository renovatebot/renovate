FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.131.0-14@sha256:c00b0b1ea89f7f031a98c6f1f5ed7383a71ca3f566d9c79c23733d1247559f8b

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
