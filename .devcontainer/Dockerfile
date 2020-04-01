FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.109.0-12@sha256:f318e4169226b848882f10584e501ab29ee3d4e728694e70d7c91795a84e4e51

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
