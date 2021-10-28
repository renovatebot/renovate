Renovate supports updating Helm Chart references within `requirements.yaml` files.

If your Helm charts make use of repository Aliases then you will need to configure an `aliases` object in your config to tell Renovate where to look for them.

If you need to change the versioning format, read the [versioning](https://docs.renovatebot.com/modules/versioning/) documentation to learn more.

To learn how to use Helm with private packages, read [private package support, Package Manager Credentials for Artifact Updating, helm](https://docs.renovatebot.com/getting-started/private-packages/#helm).
