FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.140.1-14@sha256:7d38dbdd1bf4830813e8f12e0477b677093c60cf24da15a2b0e2a4aeede69795

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
