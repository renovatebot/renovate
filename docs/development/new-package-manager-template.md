# New package manager questionnaire

**Did you read our documentation on adding a package manager?**

- [ ] I've read the [adding a package manager](adding-a-package-manager.md) documentation.

## Basics

### Name of package manager

### What language does this support?

### How popular is this package manager?

### Does this language have other (competing?) package managers?

- [ ] Yes (give names)
- [ ] No

---

## Package File Detection

### What type of package files and names does it use?

### What [fileMatch](../usage/configuration-options.md#filematch) pattern(s) should be used?

### Is it likely that many users would need to extend this pattern for custom file names?

- [ ] Yes
- [ ] No

### Is the fileMatch pattern likely to get many "false hits" for files that have nothing to do with package management?

---

## Parsing and Extraction

### Can package files have "local" links to each other that need to be resolved?

### Is there a reason why package files need to be parsed together (in serial) instead of independently?

### What format/syntax is the package file in?

- [ ] JSON
- [ ] TOML
- [ ] YAML
- [ ] Custom (explain below)

### How do you suggest parsing the file?

- [ ] Off the shelf parser
- [ ] Using regex
- [ ] Custom-parsed line by line
- [ ] Other

### Does the package file structure distinguish between different "types" of dependencies? e.g. production dependencies, development dependencies, etc?

- [ ] Yes, production and development dependencies
- [ ] No, all dependencies are treated the same

### List all the sources/syntaxes of dependencies that can be extracted

### Describe which types of dependencies above are supported and which will be implemented in future

---

## Versioning

### What versioning scheme does the package file(s) use?

### Does this versioning scheme support range constraints, e.g. `^1.0.0` or `1.x`?

- [ ] Supports range constraints (e.g `^1.0.0` or `1.x`)
- [ ] No

---

## Lookup

### Is a new datasource required? Provide details

- [ ] Yes, provide details.
- [ ] No.

### Will users need the capability to specify a custom host/registry to look up? Can it be found within the package files, or within other files inside the repository, or would it require Renovate configuration?

### Do the package files have any "constraints" on the parent language (e.g. supports only v3.x of Python) or platform (Linux, Windows, etc.) that should be used in the lookup procedure?

### Will users need the ability to configure language or other constraints using Renovate config?

---

## Artifacts

### Are lock files or checksum files used? Are they mandatory?

### If so, what tool and exact commands should be used if updating one or more package versions in a dependency file?

### If applicable, describe how the tool maintains a cache and if it can be controlled via CLI or environment variables? Do you recommend the cache be kept or disabled/ignored?

### If applicable, what command should be used to generate a lock file from scratch if you already have a package file? This will be used for "lock file maintenance"

## Other

### Is there anything else to know about this package manager?
