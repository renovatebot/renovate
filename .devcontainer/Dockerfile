FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.118.1-12@sha256:3f1a75a2cfdf54e298a5c3f97363c0103bd03b0000019dbf8a9823e4cb13dc41

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
