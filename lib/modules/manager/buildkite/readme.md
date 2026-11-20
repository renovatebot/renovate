Used for updating Buildkite plugin versions, and Docker images used to run Buildkite agents.

Docker images are extracted from the pipeline-level and step-level `image` field, and from an `image` key inside a pipeline-level or step-level `agents` block (a convention used by some organizations to select which Docker image an agent should run with).

If you need to change the versioning format, read the [versioning](../../versioning/index.md) documentation to learn more.

### Plugin configuration

Docker images referenced inside a plugin's own configuration are also extracted for a known set of plugins whose config embeds a further dependency (for example the `docker` plugin's `image` key, or `github-actions`'s per-runner `image` overrides), whether the plugin is referenced in short form (`docker#v5.14.0`) or by a git URL.

<!-- Autogenerate in https://github.com/renovatebot/renovate -->

A plugin marked "Enabled: ❌" has its config shape recorded, but its dependency isn't extracted yet - this is for a field that points at the user's own build output (a scan target) rather than a real, pinned dependency.

Any other plugin's configuration isn't inspected: only its own version pin (`name#version`) is extracted.
