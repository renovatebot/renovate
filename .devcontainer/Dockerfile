FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.129.0-14@sha256:191dd032ee7e7a44ab2bff36a47d04a67e69a13f6a213d5368c24ec230af6c14

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
