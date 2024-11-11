Extracts all Docker images from the `image` and `features` properties in these files:

- `.devcontainer.json`
- `.devcontainer/devcontainer.json`

The `devcontainer` manager does _not_ support `build.dockerFile` or `dockerComposeFile` values as these are covered by the [`dockerfile`](../dockerfile/index.md) and [`docker-compose`](../docker-compose/index.md) managers respectively.
