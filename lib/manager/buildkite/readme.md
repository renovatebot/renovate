## Overview

#### Name of package manager

[Buildkite](https://buildkite.com/docs/pipelines/plugins)

---

#### What language does this support?

N/A

---

#### Does that language have other (competing?) package managers?

N/A

## Package File Detection

#### What type of package files and names does it use?

> Filenames can be custom, but the tool automatically looks in:
>
> - buildkite.yml
> - buildkite.yaml
> - buildkite.json
> - .buildkite/pipeline.yml
> - .buildkite/pipeline.yaml
> - .buildkite/pipeline.json

---

#### What [fileMatch](https://renovatebot.com/docs/configuration-options/#filematch) pattern(s) should be used?

`['buildkite\\.ya?ml', '\\.buildkite/.+\\.ya?ml$']`

---

#### Is it likely that many users would need to extend this pattern for custom file names?

Only a small percentage of Buildkite users should need to add additional `fileMatch` patterns.

---

#### Is the fileMatch pattern likely to get many "false hits" for files that have nothing to do with package management?

Unlikely

## Parsing and Extraction

#### Can package files have "local" links to each other that need to be resolved?

No

#### Is there reason why package files need to be parsed together (in serial) instead of independently?

No

---

#### What format/syntax is the package file in? e.g. JSON, TOML, custom?

YAML is recommended. JSON is possible but won't be supported.

---

#### How do you suggest parsing the file? Using an off-the-shelf parser, using regex, or can it be custom-parsed line by line?

Parsing YAML line-by-line, looking only for the lines that interest us.

---

#### Does the package file structure distinguish between different "types" of dependencies? e.g. production dependencies, dev dependencies, etc?

No

---

#### List all the sources/syntaxes of dependencies that can be extracted:

From https://buildkite.com/docs/pipelines/plugins#plugin-sources:

> If you refer to a plugin just by name, it defaults to `https://github.com/buildkite-plugins/<name>-buildkite-plugin`. For example, a plugin name of `docker` would resolve to `https://github.com/buildkite-plugins/docker-buildkite-plugin`.
>
> To refer to a plugin in your own GitHub organization, prefix the name with the organization. For example, a plugin name of `my-org/docker` would resolve to `https://github.com/my-org/docker-buildkite-plugin`.
>
> The following are not supported and skipped over:

> You can also use fully qualified Git URLs instead of names, to refer to plugins that aren’t on GitHub, or live in private Git repositories only accessible to your agents. For example:

```
https://github.com/my-org/my-plugin.git#v1.0.0
ssh://git@github.com/my-org/my-plugin.git#v1.0.0
file:///a-local-path/my-plugin.git#v1.0.0
Branches, tags and commits are all valid after the #.
```

---

#### Describe which types of dependencies above are supported and which will be implemented in future:

The two short forms of GitHub dependencies described above are supported, but fully qualified Git URLs are not.

## Versioning

#### What versioning scheme do the package files use?

Semver

---

#### Does this versioning scheme support range constraints, e.g. `^1.0.0` or `1.x`?

No

---

#### Is this package manager used for applications, libraries, or both? If both, is there a way to tell which is which?

Everything can be thought of as an application.

---

#### If ranges are supported, are there any cases when Renovate should pin ranges to exact versions if rangeStrategy=auto?

N/A because syntax doesn't support ranges.

## Lookup

#### Is a new datasource required? Provide details

No, it can use existing GitHub datasource (tags).

---

#### Will users need the capability to specify a custom host/registry to look up? Can it be found within the package files, or within other files inside the repository, or would it require Renovate configuration?

No.

---

#### Do the package files contain any "constraints" on the parent language (e.g. supports only v3.x of Python) or platform (Linux, Windows, etc) that should be used in the lookup procedure?

No

---

#### Will users need the ability to configure language or other constraints using Renovate config?

No

## Artifacts

#### Are lock files or checksum files used? Mandatory?

Not in use

---

#### If so, what tool and exact commands should be used if updating 1 or more package versions in a dependency file?

N/A

---

#### If applicable, describe how the tool maintains a cache and if it can be controlled via CLI or env? Do you recommend the cache be kept or disabled/ignored?

N/A

---

#### If applicable, what command should be used to generate a lock file from scratch if you already have a package file? This will be used for "lock file maintenance".

N/A

## Other

#### Is there anything else to know about this package manager?

Buildkite is a great service and the company uses Renovate!
