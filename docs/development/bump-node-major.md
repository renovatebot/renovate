# How to bump Renovate to next NodeJS LTS release

## When will Renovate update its support for LTS versions?

- We will add a new LTS version as a supported version (in a minor release of Renovate) roughly ~1-2 weeks before the upcoming LTS becomes an official LTS
- We will remove an LTS as a supported version (in a major release of Renovate):
  - when the LTS is no longer supported upstream by the Node.JS project
  - when we need new features that are only available in a newer LTS
  - when the maintenance burden of supporting multiple Node.JS versions is too high

## Add new NodeJS version

- Add new version via `package.json>engines>node`
- Update the node version in the [local-development](./local-development.md) docs
- Update the node version in the GitHub Actions workflow files

## Remove old NodeJS version

- Update `package.json>engines>node`
- Mark PR as `BREAKING` by:
  - Adding the label `breaking` to the PR
  - Putting the text `feat!: require node v...` in the PR title
