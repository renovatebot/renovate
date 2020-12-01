FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.152.0-14@sha256:926cd6ee2d83ea013486788c38cea37901cf2291d993d740e54853a27a4d7d94

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
