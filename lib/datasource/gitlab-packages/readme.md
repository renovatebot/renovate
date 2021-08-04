[Gitlab Generic Packages Repository](https://docs.gitlab.com/ee/user/packages/generic_packages/) supports looking up package versions from all type of packages registry supported by Gitlab and can be used in combination with [regex managers](https://docs.renovatebot.com/modules/manager/regex/) to keep dependencies up-to-date which are not specifically supported by Renovate.

To specify which specific repository should be queried when looking up a package, the `registryUrl` has to be set like this: `https://gitlab.com/user/project`.
As an example, `https://gitlab.com/gitlab-org/ci-cd/package-stage/feature-testing/new-packages-list` would look for packages in the generic packages repository of the `gitlab-org/ci-cd/package-stage/feature-testing/new-packages-list` project.

**Usage Example**

A real world example for this specific datasource would be maintaining packages versions in a config file.
This can be achieved by configuring a generic regex manager in `renovate.json` for files named `versions.ini`:

```json
{
  "regexManagers": [
    {
      "fileMatch": ["^versions.ini$"],
      "matchStrings": [
        "# renovate: datasource=(?<datasource>.*?) depName=(?<depName>.*?)( versioning=(?<versioning>.*?))?( registryUrl=(?<registryUrl>.*?))?\\s.*?_VERSION=(?<currentValue>.*)\\s"
      ],
      "versioningTemplate": "{{#if versioning}}{{{versioning}}}{{else}}semver{{/if}}"
    }
  ]
}
```

Now you may use comments in your `versions.ini` files to automatically update dependencies, which could look like this:

```ini
# renovate: datasource=gitlab-packages depName=@gitlab-org/nk-js versioning=semver registryUrl=https://gitlab.com/gitlab-org/ci-cd/package-stage/feature-testing/new-packages-list
NKJS_VERSION=3.4.0

```

By default, `gitlab-packages` uses the `docker` versioning scheme.
