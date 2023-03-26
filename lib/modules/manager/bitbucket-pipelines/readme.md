Extracts dependencies from Bitbucket Pipelines config files.

If you need to change the versioning format, read the [versioning](https://docs.renovatebot.com/modules/versioning/) documentation to learn more.

### Using private build images

Bitbucket Pipelines supports using an authenticated Docker registry, including self-hosted private registries, Docker Hub, Amazon ECR and Google GCR.

More details can be found on the Atlassian [Bitbucket Pipeline documentation](https://support.atlassian.com/bitbucket-cloud/docs/use-docker-images-as-build-environments) site

The following `regexManager` configuration can be used for authenticated Docker Hub or private registries.
You'll need to change this example config if you're using Amazon ECR or Google GCR.

```json
{
  "regexManagers": [
    {
      "matchManagers": ["bitbucket-pipelines"],
      "matchStrings": [
        "\\s*-?\\s?image:\\s*\\n\\s+name:\\s+\"?(?<depName>[a-z/.-]+)(?::(?<currentValue>[a-z0-9.-]+))?(?:@(?<currentDigest>sha256:[a-f0-9]+))?"
      ],
      "datasourceTemplate": "docker",
      "versioningTemplate": "docker"
    }
  ]
}
```

### Replacing unauthenticated with authenticated registries

With the [regex manager](https://docs.renovatebot.com/modules/manager/regex/) you can configure Renovate to assist with migrating your Bitbucket Pipelines from unauthenticated registries to authenticated registries.

An example configuration is shown below

```json
{
  "regexManagers": [
    {
      "description": "Bitbucket Pipelines: migrate from unauthenticated to authenticated registry",
      "fileMatch": ["(^|\\/|\\.)bitbucket-pipelines.ya?ml$"],
      "matchStringsStrategy": "combination",
      "matchStrings": [
        "\\s*image:\\s*(?<depName>[a-z-]+)(?::(?<currentValue>[a-z0-9.-]+))?(?:@(?<currentDigest>sha256:[a-f0-9]+))?",
        "\\s*image:\\s*\\n\\s*name:\\s*(?<depName>[a-z-]+)(?::(?<currentValue>[a-z0-9.-]+))?(?:@(?<currentDigest>sha256:[a-f0-9]+))?\\n\\s*username:\\s*\\$SOME_USER\\n\\s*password:\\s*\\$SOME_PASSWORD"
      ],
      "datasourceTemplate": "docker",
      "autoReplaceStringTemplate": "image:\n  name: {{{packageName}}}{{#if newValue}}:{{{newValue}}}{{/if}}{{#if newDigest}}@{{{newDigest}}}{{/if}}\n  username: $SOME_USER\n  password: $SOME_PASSWORD"
    }
  ]
}
```
