FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.126.0-14@sha256:5a5a21d28a992f0e3b16df9b15ad31d01f317dbb29d00e57f9a200689a0aaaa1

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
