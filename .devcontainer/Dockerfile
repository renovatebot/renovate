FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.116.0-12@sha256:4359dcd99316728217d56d951f696c770a675524dc0a9d786882385b2c015665

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
