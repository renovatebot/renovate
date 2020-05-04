FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.115.0-12@sha256:a3eb2d4bcbadbe46995ad0b9478e547703f175c66c9a8f9a070474d94e1738d1

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
