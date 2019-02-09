## Overview

#### Name of package manager

[Poetry](https://poetry.eustace.io/)

---

#### What language does this support?

Python

---

#### Does that language have other (competing?) package managers?

pip

## Package File Detection

#### What type of package files and names does it use?

_pyproject.toml_ and _poetry.lock_

---

#### What [fileMatch](https://renovatebot.com/docs/configuration-options/#filematch) pattern(s) should be used?

_pyproject.toml_ and _poetry.lock_

---

#### Is it likely that many users would need to extend this pattern for custom file names?

No

---

#### Is the fileMatch pattern likely to get many "false hits" for files that have nothing to do with package management?

No

## Parsing and Extraction

#### Can package files have "local" links to each other that need to be resolved?

Yes

#### Is there reason why package files need to be parsed together (in serial) instead of independently?

No

---

#### What format/syntax is the package file in? e.g. JSON, TOML, custom?

TOML

---

#### How do you suggest parsing the file? Using an off-the-shelf parser, using regex, or can it be custom-parsed line by line?

TOML can be parsed line by line

---

#### Does the package file structure distinguish between different "types" of dependencies? e.g. production dependencies, dev dependencies, etc?

No

---

#### List all the sources/syntaxes of dependencies that can be extracted:

TODO

---

#### Describe which types of dependencies above are supported and which will be implemented in future:

## Versioning

#### What versioning scheme do the package files use?

<https://www.python.org/dev/peps/pep-0440>

---

#### Does this versioning scheme support range constraints, e.g. `^1.0.0` or `1.x`?

Yes

---

#### Is this package manager used for applications, libraries, or both? If both, is there a way to tell which is which?

Both, TODO

---

#### If ranges are supported, are there any cases when Renovate should pin ranges to exact versions if rangeStrategy=auto?

It isn't clear yet

## Lookup

#### Is a new datasource required? Provide details

No, it can reuse the pypi data source.

---

#### Will users need the capability to specify a custom host/registry to look up? Can it be found within the package files, or within other files inside the repository, or would it require Renovate configuration?

Yes, TODO

---

#### Do the package files contain any "constraints" on the parent language (e.g. supports only v3.x of Python) or platform (Linux, Windows, etc) that should be used in the lookup procedure?

Yes, language version can be defined using

```toml
[tool.poetry.dependencies]
python = "^3.6"
```

platform TODO

---

#### Will users need the ability to configure language or other constraints using Renovate config?

No

## Artifacts

#### Are lock files or checksum files used? Mandatory?

Yes and yes, in _poetry.lock_

---

#### If so, what tool and exact commands should be used if updating 1 or more package versions in a dependency file?

Update all dependencies

`poetry update`

Update 1 dependency

`poetry update {dependency name}`

---

#### If applicable, describe how the tool maintains a cache and if it can be controlled via CLI or env? Do you recommend the cache be kept or disabled/ignored?

TODO

---

#### If applicable, what command should be used to generate a lock file from scratch if you already have a package file? This will be used for "lock file maintenance".

`poetry lock`

## Other

#### Is there anything else to know about this package manager?

As more python package managers implement _pyproject.toml_ it may become necassary to parse the file to determine which build tools/managers are active.
