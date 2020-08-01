FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.130.0-14@sha256:5f15d4c38714975d76a9191f93d50e867d929e0c64cf3104dff3a0dfa992ae1e

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
