# New package manager questionnaire

Did you read our documentation on adding a package manager?

- [ ] I've read the [adding a package manager](adding-a-package-manager.md) documentation.

## Basics

### What's the package manager's name?

### What language(s) does this package manager support?

### How popular is this package manager?

### Are there other package managers for this language?

- [ ] Yes (give names).
- [ ] No.

## Detecting package files

### What kind of package files, and names, does this package manager use?

### Which [`fileMatch`](../usage/configuration-options.md#filematch) pattern(s) should be used?

### Do many users need to extend the [`fileMatch`](../usage/configuration-options.md#filematch) pattern for custom file names?

- [ ] Yes.
- [ ] No.

### Is the [`fileMatch`](../usage/configuration-options.md#filematch) pattern going to get many "false hits" for files that have nothing to do with package management?

## Parsing and Extraction

### Can package files have "local" links to each other that need to be resolved?

### Should package files be parsed together (in serial) or can they be parsed independently?

### Which format/syntax does the package file use?

- [ ] JSON
- [ ] TOML
- [ ] YAML
- [ ] Custom (explain below)

### How should we parse the package file(s)?

- [ ] Off the shelf parser.
- [ ] Using regex.
- [ ] Custom-parsed line by line.
- [ ] Other.

### Does the package file structure distinguish between different "types" of dependencies? e.g. production dependencies, development dependencies, etc?

- [ ] Yes, production and development dependencies.
- [ ] No, all dependencies are treated the same.

### List all the sources/syntaxes of dependencies that can be extracted

### Describe which types of dependencies above are supported and which will be implemented in future

## Versioning

### What versioning scheme does the package file(s) use?

### Does this versioning scheme support range constraints, like `^1.0.0` or `1.x`?

- [ ] Supports range constraints (e.g `^1.0.0` or `1.x`).
- [ ] No.

## Lookup

### Is a new datasource required? Provide details

- [ ] Yes, provide details.
- [ ] No.

### Will users want/need to set a custom host/registry for Renovate's lookup?

- [ ] Yes, provide details.
- [ ] No.

Where can Renovate find the custom host/registry?

- [ ] In the package file(s), provide details.
- [ ] In some other file inside the repository, provide details.
- [ ] User needs to configure Renovate where to find the information, provide details.

### Do the package files have any "constraints" on the parent language (e.g. supports only v3.x of Python) or platform (Linux, Windows, etc.) that should be used in the lookup procedure?

### Will users need the ability to configure language or other constraints using Renovate config?

- [ ] Yes, provide details.
- [ ] No.

## Artifacts

### Are lock files or checksum files used?

- [ ] Yes, uses lock file.
- [ ] Yes, uses checksum.
- [ ] Yes, uses both lock file and checksum.
- [ ] No lock file or checksum is used.

Is the locksum or checksum mandatory?

- [ ] Locksum is mandatory.
- [ ] Checksum is mandatory
- [ ] Both lock file and checksum are mandatory.
- [ ] No.

### If lockfiles or checksums are used: what tool and exact commands should be used to update one (or more) package versions in a dependency file?

### If applicable, describe how the tool maintains a cache and if it can be controlled via CLI or environment variables? Do you recommend the cache be kept or disabled/ignored?

### If applicable, what command should be used to generate a lock file from scratch if you already have a package file? This will be used for "lock file maintenance"

## Other

### Is there anything else to know about this package manager?
