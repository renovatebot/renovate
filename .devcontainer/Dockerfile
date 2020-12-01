FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.151.0-14@sha256:3c0fd1bd58e0341abd6f0de4c4c6a927df86cdd4d2c2649d4c24f3456f3c806b

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
