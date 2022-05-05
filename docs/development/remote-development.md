# Remote Development

This document gives tips and tricks on how to run Renovate in a remote container to add features or fix bugs.
You can improve this documentation by opening a pull request.
For example, if you think anything is unclear, or you think something needs to be added, open a pull request!

## First read the local development docs

Read the [local development docs](./local-development.md) first.

## What's remote development?

### Benefits

- No need to install development dependencies on your computer
- You only need a browser and internet to do work
- Once you push to your fork you can close the container
- Everytime you start work you have a fresh environment
- Reproducible development enviroment
- Similar config for all developers

### Drawbacks

- Waiting for the remote container to start up
- If your internet goes out you can't work
- If the remote container provider is down you can't work

## Gitpod

You can use [Gitpod](https://gitpod.io/) for light development work like:

- Editing the docs
- Running ESLint, Prettier

For proper development use GitHub Codespaces.

The config file for Gitpod is `.gitpod.yml` in the root of the repository.

### Gitpod tips

- Use `yarn jest:16` to run the tests on Gitpod.

### Known problems with Gitpod

`yarn jest:16` has some failing tests.

## GitHub Codespaces

The Renovate developers use [GitHub Codespaces](https://github.com/features/codespaces).
The config files are in the `.devcontainer` folder in the repository.

### Codespaces tips

List tips for codespaces here.

### Known problems with codespaces

List known problems with codespaces here.
