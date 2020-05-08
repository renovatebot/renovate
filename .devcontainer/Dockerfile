FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.117.0-12@sha256:d34f55f167dbbc559ab64af7676a013e157ad24ca8f4343e72ca5d9c7cf6471a

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
