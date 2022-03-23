# How to bump Renovate to next NodeJS LTS release

## Add new NodeJS version

- Add new version via `package.json>engines>node` and `package.json>engines-next>node`
- Update the node version in the [local-development](./local-development.md) docs
- Update the node version in the GitHub Actions workflow files

## Deprecate old NodeJS version

- Deprecate old LTS via `package.json>engines-next>node`
- Update the node version in the [local-development](./local-development.md) docs
- Remove the old node version in the GitHub Actions workflow files

## Remove old NodeJS version

- Update `package.json>engines>node`
- Mark PR as `BREAKING` by:
  - Adding the label `breaking` to the PR
  - Putting the text `BREAKING CHANGE: <breaking cause>` in the PR content footer
