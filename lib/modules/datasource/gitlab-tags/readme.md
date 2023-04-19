[GitLab Tags API](https://docs.gitlab.com/ee/api/tags.html) supports looking up [Git tags](https://docs.gitlab.com/ee/topics/git/tags.html#tags) and can be used in combination with [regex managers](https://docs.renovatebot.com/modules/manager/regex/) to keep dependencies up-to-date which are not specifically supported by Renovate.

To specify which specific repository should be queried when looking up a package, the `packageName` should be set to the project path.

As an example, `gitlab-org/ci-cd/package-stage/feature-testing/new-packages-list` would look for releases in the `gitlab-org/ci-cd/package-stage/feature-testing/new-packages-list` project.

To specify where to find a self-hosted GitLab instance, specify `registryUrl`. An example would be `https://gitlab.company.com`.

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
# renovate: datasource=gitlab-tags depName=gitlab-org/ci-cd/package-stage/feature-testing/new-packages-list versioning=semver registryUrl=https://gitlab.com
NKJS_VERSION=3.4.0
```

By default, `gitlab-tags` uses the `semver-coerced` versioning scheme.
