FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.112.0-12@sha256:99aa9f37dbdeee160343df79f065e8380c6845551a4c51efcc8ec3343f81d590

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
