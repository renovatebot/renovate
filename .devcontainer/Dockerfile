FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.138.0-14@sha256:5f58288eeab30f68edfeb99f7517537d131eba85e615fd35b328020a02ead92b

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
