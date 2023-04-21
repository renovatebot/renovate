[GitLab Packages API](https://docs.gitlab.com/ee/api/packages.html) supports looking up package versions from [all types of packages registry supported by GitLab](https://docs.gitlab.com/ee/user/packages/package_registry/index.html) and can be used in combination with [regex managers](https://docs.renovatebot.com/modules/manager/regex/) to keep dependencies up-to-date which are not specifically supported by Renovate.

To specify which specific repository should be queried when looking up a package, the `packageName` should be formed with the project path first, then a `:` and finally the package name.

As an example, `gitlab-org/ci-cd/package-stage/feature-testing/new-packages-list:@gitlab-org/nk-js` would look for the`@gitlab-org/nk-js` packages in the generic packages repository of the `gitlab-org/ci-cd/package-stage/feature-testing/new-packages-list` project.

To specify where to find a self-hosted GitLab instance, specify `registryUrl`.
An example would be `https://gitlab.company.com`.

If you are using a self-hosted GitLab instance, please note the following requirements:

- If you are on the `Free` edition, this datasource requires at least GitLab 13.3
- If you are on the `Premium` or the `Ultimate` edition, this datasource requires at least GitLab 11.8, but GitLab 12.9 or more is recommended if you have a lot of packages with different names in the same project

**Usage Example**

A real-world example for this specific datasource would be maintaining package versions in a config file.
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
# renovate: datasource=gitlab-packages depName=gitlab-org/ci-cd/package-stage/feature-testing/new-packages-list:@gitlab-org/nk-js versioning=semver registryUrl=https://gitlab.com
NKJS_VERSION=3.4.0

```

By default, `gitlab-packages` uses the `docker` versioning scheme.
