# Remote Development

This document gives tips and tricks on how to run Renovate in a remote container to add features or fix bugs.
You can improve this documentation by opening a pull request.
For example, if you think anything is unclear, or you think something needs to be added, open a pull request!

## First read the local development docs

Read the [local development docs](./local-development.md) first.

## What's remote development?

When you work locally, you install the tooling and code editor on your computer.
You are responsible for setting up the environment correctly.

With remote development you use a container that's hosted somewhere else.
You'll use the same code editor and have the same config as all other developers.

### Benefits

- You only need a browser and internet
- You don't need to install development dependencies on your computer
- Start work in a fresh environment every time
- Reproducible development environment
- Similar config for all developers
- Use VS Code in the browser

### Drawbacks

- Waiting for the remote container to start
- If your internet is down you can't work
- If Codespaces is down you can't work

## GitHub Codespaces

The Renovate developers use [GitHub Codespaces](https://github.com/features/codespaces).
The config files are in the `.devcontainer` folder in the repository.
