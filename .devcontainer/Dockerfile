FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.121.0-14@sha256:bb0690114fa5141dfe46ea6050eedd05cee3b0f866ec473c1f2e6263f3eddad3

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
