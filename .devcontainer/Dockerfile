FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.145.1-14@sha256:a1cfa964efec135f9698ea924ea4e1c2085d26691a79d83826b40230c8e442e5

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
