The `regex` manager is designed to allow users to manually configure Renovate for how to find dependencies that aren't detected by the built-in package managers.

This manager is unique in Renovate in that:

- It is configurable via regex named capture groups
- Through the use of the `regexManagers` config, multiple "regex managers" can be created for the same repository
- It can extract any `datasource`

We have [additional Handlebars helpers](https://docs.renovatebot.com/templates/#additional-handlebars-helpers) which help you perform common transformations on the regex manager's template fields.
Also read the documentation for the [`regexManagers` config option](https://docs.renovatebot.com/configuration-options/#regexmanagers).

### Required Fields

The first two required fields are `fileMatch` and `matchStrings`.
`fileMatch` works the same as any manager, while `matchStrings` is a `regexManagers` concept and is used for configuring a regular expression with named capture groups.

In order for Renovate to look up a dependency and decide about updates, it then needs the following information about each dependency:

- The dependency's name
- Which `datasource` to look up (e.g. npm, Docker, GitHub tags, etc)
- Which version scheme to apply (defaults to `semver`, but also may be other values like `pep440`)

Configuration-wise, it works like this:

- You must capture the `currentValue` of the dependency in a named capture group
- You must have either a `depName` capture group or a `depNameTemplate` config field
- You can optionally have a `packageName` capture group or a `packageNameTemplate` if it differs from `depName`
- You must have either a `datasource` capture group or a `datasourceTemplate` config field
- You can optionally have a `depType` capture group or a `depTypeTemplate` config field
- You can optionally have a `versioning` capture group or a `versioningTemplate` config field. If neither are present, `semver` will be used as the default
- You can optionally have an `extractVersion` capture group or an `extractVersionTemplate` config field
- You can optionally have a `currentDigest` capture group.
- You can optionally have a `registryUrl` capture group or a `registryUrlTemplate` config field
  - If it's a valid URL, it will be converted to the `registryUrls` field as a single-length array.

### Regular Expression Capture Groups

To be fully effective with the regex manager, you will need to understand regular expressions and named capture groups, although sometimes enough examples can compensate for lack of experience.

Consider this `Dockerfile`:

```Dockerfile
FROM node:12
ENV YARN_VERSION=1.19.1
RUN curl -o- -L https://yarnpkg.com/install.sh | bash -s -- --version ${YARN_VERSION}
```

You would need to capture the `currentValue` using a named capture group, like so: `ENV YARN_VERSION=(?<currentValue>.*?)\\n`.

If you're looking for an online regex testing tool that supports capture groups, try [https://regex101.com/](<https://regex101.com/?flavor=javascript&flags=g&regex=ENV%20YARN_VERSION%3D(%3F%3CcurrentValue%3E.*%3F)%5Cn&testString=FROM%20node%3A12%0AENV%20YARN_VERSION%3D1.19.1%0ARUN%20curl%20-o-%20-L%20https%3A%2F%2Fyarnpkg.com%2Finstall.sh%20%7C%20bash%20-s%20--%20--version%20%24%7BYARN_VERSION%7D>).
Be aware that backslashes (`'\'`) of the resulting regex have to still be escaped e.g. `\n\s` --> `\\n\\s`.
You can use the Code Generator in the sidebar and copy the regex in the generated "Alternative syntax" comment into JSON.

The `regex` manager uses [RE2](https://github.com/google/re2/wiki/WhyRE2) which does not support [backreferences and lookahead assertions](https://github.com/uhop/node-re2#limitations-things-re2-does-not-support).
The `regex` manager matches are done per-file and not per-line, you should be aware when using the `^` and/or `$` regex assertions.

### Configuration templates

In many cases, named capture groups alone won't be enough and you'll need to configure Renovate with additional information about how to look up a dependency.
Continuing the above example with Yarn, here is the full config:

```json
{
  "regexManagers": [
    {
      "fileMatch": ["^Dockerfile$"],
      "matchStrings": ["ENV YARN_VERSION=(?<currentValue>.*?)\\n"],
      "depNameTemplate": "yarn",
      "datasourceTemplate": "npm"
    }
  ]
}
```

### Advanced Capture

Let's say that your `Dockerfile` has many `ENV` variables you want to keep updated and you prefer not to write one `regexManagers` rule per variable.
Instead you could enhance your `Dockerfile` like the following:

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

The above (obviously not a complete `Dockerfile`, but abbreviated for this example), could then be supported accordingly:

```json
{
  "regexManagers": [
    {
      "fileMatch": ["^Dockerfile$"],
      "matchStrings": [
        "datasource=(?<datasource>.*?) depName=(?<depName>.*?)( versioning=(?<versioning>.*?))?\\sENV .*?_VERSION=(?<currentValue>.*)\\s"
      ],
      "versioningTemplate": "{{#if versioning}}{{{versioning}}}{{else}}semver{{/if}}"
    },
    {
      "fileMatch": ["^Dockerfile$"],
      "matchStrings": [
        "ARG IMAGE=(?<depName>.*?):(?<currentValue>.*?)@(?<currentDigest>sha256:[a-f0-9]+)s"
      ],
      "datasourceTemplate": "docker"
    }
  ]
}
```

In the above the `versioningTemplate` is not actually necessary because Renovate already defaults to `semver` versioning, but it has been included to help illustrate why we call these fields _templates_.
They are named this way because they are compiled using Handlebars and so can be composed from values you collect in named capture groups.
You will usually want to use the triple brace `{{{ }}}` template (e.g. `{{{versioning}}}`) to be safe because Handlebars escapes special characters by default with double braces.

By adding the comments to the `Dockerfile`, you can see that instead of four separate `regexManagers` being required, there is now only one - and the `Dockerfile` itself is now somewhat better documented too.
The syntax we used there is completely arbitrary and you may choose your own instead if you prefer - just be sure to update your `matchStrings` regex.
