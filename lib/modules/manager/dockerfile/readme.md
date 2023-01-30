Extracts all Docker images in a `Dockerfile`.

If Renovate does not update your Dockerfile images correctly, you may need to change the versioning format.
Read [Renovate's Docker Versioning](https://docs.renovatebot.com/modules/versioning/#docker-versioning) docs to learn how.

Renovate's managers does not understand versioning, that's up to Renovate's versioning modules.
The default Docker versioning for Docker datasources treats suffixes as "compatibility", for example: `-alpine`.
Many Docker images are _not_ SemVer compliant because they use such suffixes in their tags.
