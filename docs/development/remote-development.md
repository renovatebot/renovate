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
- If your internet is down or Gitpod or GitHub Codespaces are down then you can't work

## Gitpod

You can use [Gitpod](https://gitpod.io/) for light development work like:

- Editing the docs
- Running ESLint, Prettier

For proper development, use GitHub Codespaces.

The config file for Gitpod is `.gitpod.yml` in the root of the repository.

Gitpod comes with 50 free hours each month.
If you need more hours you'll need to buy a plan with more hours.

### Gitpod tips

- Use `yarn jest:16` to run the tests on Gitpod

### Known problems with Gitpod

- `yarn jest:16` has some failing tests
- You can't preview Markdown files in the VS Code online editor

## GitHub Codespaces

The Renovate developers use [GitHub Codespaces](https://github.com/features/codespaces).
The config files are in the `.devcontainer` folder in the repository.

You can only use GitHub Codespaces if you're invited into the beta by GitHub.
