FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.111.0-12@sha256:0f7ea82033f6b588acbe25dd3db0da3f76ac2b5fae8e2539a4054c40eec46ecd

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
