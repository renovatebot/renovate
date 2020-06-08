FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.121.0-12@sha256:3bbb8adaab0360fb5952e982a92465e75c001c58ce650a0a98498f97350ab089

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
