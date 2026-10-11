Used for updating Buildkite plugin versions, and Docker images used to run Buildkite agents.

Docker images are extracted from the pipeline-level and step-level `image` field, and from an `image` key inside a pipeline-level or step-level `agents` block (a convention used by some organizations to select which Docker image an agent should run with). Docker images referenced inside a plugin's own configuration (for example the `docker` plugin's `image` key) are not extracted.

If you need to change the versioning format, read the [versioning](../../versioning/index.md) documentation to learn more.
