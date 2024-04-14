With the `regex` manager you can configure Renovate so it finds dependencies that are not detected by its other built-in package managers.

Renovate supports the `ECMAScript (JavaScript)` flavor of regex.

Renovate uses the `uhop/node-re2` package that provides bindings for [`google/re2`](https://github.com/google/re2).
Read about [`uhop/node-re2`'s limitations in their readme](https://github.com/uhop/node-re2#limitations-things-re2-does-not-support).
The `regex` manager is unique in Renovate because:

- It is configurable via regex named capture groups
- It can extract any `datasource`
- By using the `customManagers` config, you can create multiple "regex managers" for the same repository

We have [additional Handlebars helpers](../../../templates.md#additional-handlebars-helpers) to help you perform common transformations on the regex manager's template fields.
Also read the documentation for the [`customManagers` config option](../../../configuration-options.md#custommanagers).

### Required Fields

The first two required fields are `fileMatch` and `matchStrings`:

- `fileMatch` works the same as any manager
- `matchStrings` is a `regex` custom manager concept and is used for configuring a regular expression with named capture groups

Before Renovate can look up a dependency and decide about updates, it needs this information about each dependency:

- The dependency's name
- Which `datasource` to use: npm, Docker, GitHub tags, and so on. For how to format this references see [datasource overview](../../datasource/index.md#supported-datasources)
- Which version scheme to use: defaults to `semver-coerced`, but you may set another value like `pep440`. Supported versioning schemes can be found in the [versioning overview](../../versioning/index.md#supported-versioning)

Configuration-wise, it works like this:

- You must capture the `currentValue` of the dependency in a named capture group
- You must have either a `depName` capture group or a `depNameTemplate` config field
- You can optionally have a `packageName` capture group or a `packageNameTemplate` if it differs from `depName`
- You must have either a `datasource` capture group or a `datasourceTemplate` config field
- You can optionally have a `depType` capture group or a `depTypeTemplate` config field
- You can optionally have a `versioning` capture group or a `versioningTemplate` config field. If neither are present, Renovate will use `semver-coerced` as the default
- You can optionally have an `extractVersion` capture group or an `extractVersionTemplate` config field
- You can optionally have a `currentDigest` capture group
- You can optionally have a `registryUrl` capture group or a `registryUrlTemplate` config field. If it's a valid URL, it will be converted to the `registryUrls` field as a single-length array
- You can optionally have an `indentation` capture group. It must be either empty or whitespace only, otherwise it will be reset to an empty string

### Regular Expression Capture Groups

To be effective with the regex manager, you should understand regular expressions and named capture groups.
But enough examples may compensate for lack of experience.

Take this `Dockerfile` as an example:

```Dockerfile
FROM node:12
ENV YARN_VERSION=1.19.1
RUN curl -o- -L https://yarnpkg.com/install.sh | bash -s -- --version ${YARN_VERSION}
```

You would need to capture the `currentValue` with a named capture group, like this: `ENV YARN_VERSION=(?<currentValue>.*?)\\n`.

If you're looking for an online regex testing tool that supports capture groups, try [regex101.com](<https://regex101.com/?flavor=javascript&flags=g&regex=ENV%20YARN_VERSION%3D(%3F%3CcurrentValue%3E.*%3F)%5Cn&testString=FROM%20node%3A12%0AENV%20YARN_VERSION%3D1.19.1%0ARUN%20curl%20-o-%20-L%20https%3A%2F%2Fyarnpkg.com%2Finstall.sh%20%7C%20bash%20-s%20--%20--version%20%24%7BYARN_VERSION%7D>).
You must select the `ECMAScript (JavaScript)` flavor of regex.
Be aware that backslashes (`'\'`) of the resulting regex have to still be escaped e.g. `\n\s` --> `\\n\\s`.
You can use the Code Generator in the sidebar and copy the regex in the generated "Alternative syntax" comment into JSON.

The `regex` manager uses [RE2](https://github.com/google/re2/wiki/WhyRE2) which **does not support** [backreferences and lookahead assertions](https://github.com/uhop/node-re2#limitations-things-re2-does-not-support).
The `regex` manager matches are done per-file and not per-line, you should be aware when using the `^` and/or `$` regex assertions.

### Configuration templates

In many cases, named capture groups alone aren't enough and you'll need to give Renovate more information so it can look up a dependency.
Continuing the above example with Yarn, here is the full Renovate config:

```json
{
  "customManagers": [
    {
      "customType": "regex",
      "fileMatch": ["^Dockerfile$"],
      "matchStrings": ["ENV YARN_VERSION=(?<currentValue>.*?)\\n"],
      "depNameTemplate": "yarn",
      "datasourceTemplate": "npm"
    }
  ]
}
```

### Advanced Capture

Say your `Dockerfile` has many `ENV` variables that you want to keep up-to-date.
But you don't want to write a regex custom manager rule for _each_ variable.
Instead you enhance your `Dockerfile` like this:

```Dockerfile
ARG IMAGE=node:12@sha256:6e5264cd4cfaefd7174b2bc10c7f9a1c2b99d98d127fc57a802d264da9fb43bd
FROM ${IMAGE}
 # renovate: datasource=github-tags depName=nodejs/node versioning=node
ENV NODE_VERSION=10.19.0
 # renovate: datasource=github-releases depName=composer/composer
ENV COMPOSER_VERSION=1.9.3
# renovate: datasource=docker depName=docker versioning=docker
ENV DOCKER_VERSION=19.03.1
# renovate: datasource=npm depName=yarn
ENV YARN_VERSION=1.19.1
```

This `Dockerfile` is meant as an example, your `Dockerfile` may be a lot bigger.

You could configure Renovate to update the `Dockerfile` like this:

```json
{
  "customManagers": [
    {
      "customType": "regex",
      "fileMatch": ["^Dockerfile$"],
      "matchStrings": [
        "datasource=(?<datasource>.*?) depName=(?<depName>.*?)( versioning=(?<versioning>.*?))?\\sENV .*?_VERSION=(?<currentValue>.*)\\s"
      ],
      "versioningTemplate": "{{#if versioning}}{{{versioning}}}{{else}}semver{{/if}}"
    },
    {
      "fileMatch": ["^Dockerfile$"],
      "matchStrings": [
        "ARG IMAGE=(?<depName>.*?):(?<currentValue>.*?)@(?<currentDigest>sha256:[a-f0-9]+)\\s"
      ],
      "datasourceTemplate": "docker"
    }
  ]
}
```

We could drop the `versioningTemplate` because Renovate defaults to `semver-coerced` versioning.
But we included the `versioningTemplate` config option to show you why we call these fields _templates_: because they are compiled using Handlebars and so can be composed from values you collect in named capture groups.

You should use triple brace `{{{ }}}` templates like `{{{versioning}}}` to be safe.
This is because Handlebars escapes special characters with double braces (by default).

By adding `renovate: datasource=` and `depName=` comments to the `Dockerfile` you only need _one_ `customManager` instead of _four_.
The `Dockerfile` is documented better as well.

The syntax in the example is arbitrary, and you can set your own syntax.
If you do, update your `matchStrings` regex!

For example the `appVersion` property in a `Chart.yaml` of a Helm chart is always referenced to an Docker image.
In such scenarios, some values can be hard-coded.
For example:

```yaml
apiVersion: v2
name: amazon-eks-pod-identity-webhook
description: A Kubernetes webhook for pods that need AWS IAM access
version: 1.0.3
type: application
# renovate: image=amazon/amazon-eks-pod-identity-webhook
appVersion: 'v0.4.0'
```

Using the `customManagers` below, Renovate looks for available Docker tags of the image `amazon/amazon-eks-pod-identity-webhook`.

```json
{
  "customManagers": [
    {
      "customType": "regex",
      "datasourceTemplate": "docker",
      "fileMatch": ["(^|/)Chart\\.yaml$"],
      "matchStrings": [
        "#\\s?renovate: image=(?<depName>.*?)\\s?appVersion:\\s?\\\"?(?<currentValue>[\\w+\\.\\-]*)\""
      ]
    }
  ]
}
```

### Using customManager to update the dependency name in addition to version

#### Updating `gitlab-ci include` dep names

You can use the regex manager to update the `depName` and the version.
This can be handy when the location of files referenced in gitlab-ci `includes:` fields has changed.

You may need to set a second `matchString` for the new name to ensure the regex manager can detect the new value.
For example:

```json
{
  "customManagers": [
    {
      "customType": "regex",
      "fileMatch": [".*y[a]?ml$"],
      "matchStringsStrategy": "combination",
      "matchStrings": [
        "['\"]?(?<depName>/pipeline-fragments/fragment-version-check)['\"]?\\s*ref:\\s['\"]?(?<currentValue>[\\d-]*)['\"]?",
        "['\"]?(?<depName>pipeline-solutions/gitlab/fragments/fragment-version-check)['\"]?\\s*ref:\\s['\"]?(?<currentValue>[\\d-]*)['\"]?"
      ],
      "depNameTemplate": "pipeline-solutions/gitlab/fragments/fragment-version-check",
      "autoReplaceStringTemplate": "'{{{depName}}}'\n    ref: {{{newValue}}}",
      "datasourceTemplate": "gitlab-tags",
      "versioningTemplate": "gitlab-tags"
    }
  ]
}
```

The config above will migrate:

```yaml
- project: 'pipeline-fragments/docker-lint'
  ref: 2-4-0
  file: 'ci-include-docker-lint-base.yml'
```

To this:

```yaml
- project: 'pipeline-solutions/gitlab/fragments/docker-lint'
  ref: 2-4-1
  file: 'ci-include-docker-lint-base.yml'
```
