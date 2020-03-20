FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.108.0-12@sha256:0afe371ce3995bb57590075d902619c2098c9071e8a4cd71f7c00082faede09f

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
