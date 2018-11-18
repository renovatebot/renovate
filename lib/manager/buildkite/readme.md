# Package Manager Description

*Name of package manager*: 

[Buildkite](https://buildkite.com/docs/pipelines/plugins)

---

*What language does this support?*

N/A

---

*Does that language have other (competing?) package managers?* 

N/A

---

*What type of package files and names does it use?* 

Filenames can be custom, but the rool automatically looks in:

   - buildkite.yml
   - buildkite.yaml
   - buildkite.json
   - .buildkite/pipeline.yml
   - .buildkite/pipeline.yaml
   - .buildkite/pipeline.json

---

*What [fileMatch](https://renovatebot.com/docs/configuration-options/#filematch) pattern(s) should be used?* 

`['\\.buildkite/.+\\.yml$']`

---

*Is it likely that many users would need to extend this pattern for custom file names?*

It's quite likely that some users would need to add customer file matches.

---

*Is the fileMatch pattern likely to get many "false hits"?*

Unlikely

---

*If a repository contains more than one package file, can they have dependencies on each other or is there any reason why they need to be read/parsed in serial instead of in parallel/independently?*

No

---

*What format/syntax is the package file in? e.g. JSON, toml, custom?*

YAML is recommended

---

*How do you suggest parsing the file? Using an off-the-shelf parser, using regex, or can it be custom-parsed line by line?*

Parsing line-by-line.

---

*Does the package file distinguish between different "types" of dependencies? e.g. production dependencies, dev dependencies, etc? Or are they normally split into different files?*

No

---

*What versioning scheme do the package files use?*

Semver

---

*Does this versioning scheme support range constraints, e.g. `^1.0.0` or `1.x`?*

No

---

*Do the package files contain references to which registries/hosts should be used for looking up package versions?*

No

---

*Do the package files contain any "constraints" on the parent language (e.g. supports only v3.x of Python) or platform (Linux, Windows, etc)?*

N/A

---

*If the package files contain language or platform restrictions, are these used in the lookup of package versions?*

N/A

---

*Are there any types of dependencies or types of versions that Renovate should ignore?*

Those without versions.

---

*Is this package manager used for applications, libraries, or both? If both, is there a way to tell which is which?*

Everything can be thought of as an application and therefore can be pinned.

---

*What type of package URLs/datasources are likely to be extracted? e.g. custom registry, github URLs, etc?*

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

*Describe which types of dependencies are supported and which will be implemented in future:*

The two short forms of GitHub dependencies described above are supported, but fully qualified Git URLs are not.

---

*Is a new datasource required? Provide details*

No, it can use existing GitHub datasource (tags).

---

*Should Renovate default to pinning dependencies if it's of type "application"?*

N/A because syntax doesn't support ranges.

---

*Are lock files or checksum files used? Mandatory?*

Not in use

---

*If so, what tool and exact commands should be used if updating 1 or more package versions in a dependency file?*

N/A

---

*If applicable, describe how the tool maintains a cache and if it can be controlled via CLI or env? Do you recommend the cache be kept or disabled/ignored?*

N/A

---

*If applicable, what command should be used to generate a lock file from scratch if you already have a package file? This will be used for "lock file maintenance".*

N/A

---

*Is there anything else to know about this package manager?*

Buildkite is a great service and they are active users of Renovate!
