FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.125.0-14@sha256:ab275aeb9067cb15cc58c1d5b570380b14118b451647168da20e87c9e900ca3c

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
