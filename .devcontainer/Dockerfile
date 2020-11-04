FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.148.0-14@sha256:678646c6c4f2bfaef505c00754a1a7e858ad5e456adf2ee8417df42092c1347c

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
