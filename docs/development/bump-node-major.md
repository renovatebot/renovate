# How to bump Renovate to next NodeJS lts release

## Add new NodeJS version

- Add new versions via `package.json>engines>node` and `package.json>engines-next>node`
- Update node at [local-development](./local-development.md)
- Update node versions at Github Actions

## Deprecate old NodeJS version

- Deprecate old lts via `package.json>engines-next>node`
- Update node [local-development](./local-development.md)
- Remove node versions at Github Actions

## Remove old NodeJS version

- Update `package.json>engines>node`
- Mark PR as `BREAKING`
