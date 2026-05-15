# How to bump Renovate to next NodeJS LTS release

## When will Renovate update its support for LTS versions?

- We will add a new LTS version to Renovate's support roughly ~1-2 weeks before the upcoming LTS becomes an official LTS
- We will remove an LTS as a supported version when the LTS is no longer supported upstream by the Node.JS project

## Add new NodeJS version

- Add new version via `package.json>engines>node`
- Update the node version in the [local-development](./local-development.md) docs
- Update the node version in the GitHub Actions workflow files

## Remove old NodeJS version

- Update `package.json>engines>node`
- Mark PR as `BREAKING` by:
  - Adding the label `breaking` to the PR
  - Putting the text `BREAKING CHANGE: <breaking cause>` in the PR content footer
