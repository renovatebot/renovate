# Remote Development

## Working in a hosted Dev Container

GitHub Codespaces runs the repository's Dev Container on a remote host. For the shared contributor workflow, see [Development setup](./setup.md).

### Benefits

- You only need a browser and internet
- You do not need to install development dependencies on your computer
- Start work in a fresh environment every time
- Reproducible development environment
- Similar config for all developers
- Use VS Code in the browser

### Drawbacks

- Waiting for the remote container to start
- If your internet is down you cannot work
- If Codespaces is down you cannot work

## GitHub Codespaces

The Renovate developers use [GitHub Codespaces](https://github.com/features/codespaces).
The config files are in the `.devcontainer` folder in the repository.
