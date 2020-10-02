FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.144.0-14@sha256:9b969382ecb0ac1937438c470a838e90252110cb1b2a82b0433d9f9de05e1a13

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
