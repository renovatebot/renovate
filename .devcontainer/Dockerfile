FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.141.0-14@sha256:82309220520d50e35b76756aaa180f82ea335a30ebacf7269e3ea2a6ffc64616

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
