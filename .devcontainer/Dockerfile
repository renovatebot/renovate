FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.139.1-14@sha256:fa9154f19c9b7d23b884ab9056d1cc89a255ef5b6918f9c5552ba27f16718543

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
