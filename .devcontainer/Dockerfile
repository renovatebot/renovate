FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0.145.0-14@sha256:4b2cb81340933f2446b94bd080a4590c6a238c526def798871c54d059d886fdb

# see https://mcr.microsoft.com/v2/vscode/devcontainers/typescript-node/tags/list for tags
# Add missing renovate dev tools
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
   && apt-get -y install --no-install-recommends --no-upgrade build-essential \
   && rm -rf /var/lib/apt/lists/*
