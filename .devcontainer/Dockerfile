FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.142.0-14@sha256:440f07153c1e0d22a03f1a21f0deec16855d080e80939a01bde2d017fda4f7dd

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
