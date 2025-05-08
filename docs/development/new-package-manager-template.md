# New package manager questionnaire

Did you read our documentation on adding a package manager?

- [ ] I've read the [adding a package manager](adding-a-package-manager.md) documentation.

## Basics

### What's the name of the package manager?

### What language(s) does this package manager support?

### How popular is this package manager?

### Does this language have other (competing?) package managers?

- [ ] Yes (give names).
- [ ] No.

### What are the big selling points for this package manager?

Explain how this package manager is different from existing ones.

## Detecting package files

### What kind of package files, and names, does this package manager use?

### Which [`managerFilePatterns`](../usage/configuration-options.md#managerfilepatterns) pattern(s) should Renovate use?

### Do many users need to extend the [`managerFilePatterns`](../usage/configuration-options.md#managerfilepatterns) pattern for custom file names?

- [ ] Yes, provide details.
- [ ] No.

### Is the [`managerFilePatterns`](../usage/configuration-options.md#managerfilepatterns) pattern going to get many "false hits" for files that have nothing to do with package management?

## Parsing and Extraction

### Can package files have "local" links to each other that need to be resolved?

### Package file parsing method

The package files should be:

- [ ] Parsed together (in serial).
- [ ] Parsed independently.

### Which format/syntax does the package file use?

- [ ] JSON
- [ ] TOML
- [ ] YAML
- [ ] Custom (explain below)

### How should we parse the package files?

- [ ] Off the shelf parser.
- [ ] Using regex.
- [ ] Custom-parsed line by line.
- [ ] Other.

### Does the package file have different "types" of dependencies?

- [ ] Yes, production and development dependencies.
- [ ] No, all dependencies are treated the same.

### List all the sources/syntaxes of dependencies that can be extracted

### Describe which types of dependencies above are supported and which will be implemented in future

## Versioning

### What versioning scheme does the package file(s) use?

### Does this versioning scheme support range constraints, like `^1.0.0` or `1.x`?

- [ ] Supports range constraints (for example: `^1.0.0` or `1.x`), provide details.
- [ ] No.

## Lookup

### Is a new datasource required?

- [ ] Yes, provide details.
- [ ] No.

### Will users want (or need to) set a custom host or custom registry for Renovate's lookup?

- [ ] Yes, provide details.
- [ ] No.

Where can Renovate find the custom host/registry?

- [ ] No custom host or registry is needed.
- [ ] In the package file(s), provide details.
- [ ] In some other file inside the repository, provide details.
- [ ] User needs to configure Renovate where to find the information, provide details.

### Are there any constraints in the package files that Renovate should use in the lookup procedure?

- [ ] Yes, there are constraints on the parent language (for example: supports only Python `v3.x`), provide details.
- [ ] Yes, there are constraints on the parent platform (for example: only supports Linux, Windows, etc.), provide details.
- [ ] Yes, some other kind of constraint, provide details.
- [ ] No constraints.

### Will users need the ability to configure language or other constraints using Renovate config?

- [ ] Yes, provide details.
- [ ] No.

## Artifacts

### Does the package manager use a lock file or checksum file?

- [ ] Yes, uses lock file.
- [ ] Yes, uses checksum file.
- [ ] Yes, uses lock file _and_ checksum file.
- [ ] No lock file or checksum.

### Is the locksum or checksum mandatory?

- [ ] Yes, locksum is mandatory.
- [ ] Yes, checksum is mandatory.
- [ ] Yes, lock file _and_ checksum are mandatory.
- [ ] No mandatory locksum or checksum.
- [ ] Package manager does not use locksums or checksums.

### If lockfiles or checksums are used: what tool and exact commands should Renovate use to update one (or more) package versions in a dependency file?

### Package manager cache

#### Does the package manager use a cache?

- [ ] Yes, provide details.
- [ ] No.

#### If the package manager uses a cache, how can Renovate control the cache?

- [ ] Package manager does not use a cache.
- [ ] Controlled via command line interface, provide details.
- [ ] Controlled via environment variables, provide details.

#### Should Renovate keep a cache?

- [ ] Yes, ignore/disable the cache.
- [ ] No.

### Generating a lockfile from scratch

Renovate can perform "lock file maintenance" by getting the package manager to generate a lockfile from scratch.
Can the package manager generate a lockfile from scratch?

- [ ] Yes, explain which command Renovate should use to generate the lockfile.
- [ ] No, the package manager does _not_ generate a lockfile from scratch.
- [ ] No, the package manager does not use lockfiles.

## Other

### What else should we know about this package manager?
