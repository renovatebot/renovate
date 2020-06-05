FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.120.0-12@sha256:77b18e0ff09ffb904608a67d6790e46a2bc28c6092d16322c3d2e44ce498e738

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
