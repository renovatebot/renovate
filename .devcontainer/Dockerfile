FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.154.1-14@sha256:12dcb243d16f5f9e57cd755343eeb74a8d734123d64c4e3384fac9c6676560ef

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing Renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
