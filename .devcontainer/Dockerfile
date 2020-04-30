FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.113.0-12@sha256:8acceae058f64eccba68e2b01dda1c1bd4bb8777eacd27736b8faad4f514cb35

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
