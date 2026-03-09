Used for updating [devbox](https://www.jetify.com/devbox) projects.

Devbox is a tool for creating isolated, reproducible development environments that run anywhere.

It uses nix packages sourced from the devbox package registry.

### Package versioning

Some packages in the devbox registry don't follow the basic versioning we have set up.
We have allowed for defining an versioning API override within `tool-versioning.ts`.
