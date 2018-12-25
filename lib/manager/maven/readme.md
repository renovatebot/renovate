## Overview

#### Name of package manager

Maven

---

#### What language does this support?

Java

---

#### Does that language have other (competing?) package managers?

Gradle 

## Package File Detection

#### What type of package files and names does it use?

"pomfile" usually named pom.xml. It is possible to override default pom.xml with any filename

 `mvn -f <path>/custom_pom.xml <command>`

---

#### What [fileMatch](https://renovatebot.com/docs/configuration-options/#filematch) pattern(s) should be used?

`['(^|/)([\\w-]*)pom.xml$']`

---

#### Is it likely that many users would need to extend this pattern for custom file names?

Not many but some user might use custom filenames.

---

#### Is the fileMatch pattern likely to get many "false hits" for files that have nothing to do with package management?

Usually "pomfile" is in the root of the project and it is not likely that it will be many other xml files in the same directory.

## Parsing and Extraction

#### Can package files have "local" links to each other that need to be resolved?

No

#### Is there reason why package files need to be parsed together (in serial) instead of independently?

No

---

#### What format/syntax is the package file in? e.g. JSON, TOML, custom?

XML

---

#### How do you suggest parsing the file? Using an off-the-shelf parser, using regex, or can it be custom-parsed line by line?

Any XML reader.

---

#### Does the package file structure distinguish between different "types" of dependencies? e.g. production dependencies, dev dependencies, etc?

No

---

#### List all the sources/syntaxes of dependencies that can be extracted:

---

#### Describe which types of dependencies above are supported and which will be implemented in future:

## Versioning

#### What versioning scheme do the package files use?

---

#### Does this versioning scheme support range constraints, e.g. `^1.0.0` or `1.x`?

No, it has its own syntax for supporting [versions](https://maven.apache.org/enforcer/enforcer-rules/versionRanges.html).

---

#### Is this package manager used for applications, libraries, or both? If both, is there a way to tell which is which?
It is general package manager. No need to separate it.

---

#### If ranges are supported, are there any cases when Renovate should pin ranges to exact versions if rangeStrategy=auto?

## Lookup

#### Is a new datasource required? Provide details
Custom sources are possible with [settings.xml](https://maven.apache.org/settings.html).

---

#### Will users need the capability to specify a custom host/registry to look up? Can it be found within the package files, or within other files inside the repository, or would it require Renovate configuration?

If host is custom it should be possible to find it inside settings.xml

---

#### Do the package files contain any "constraints" on the parent language (e.g. supports only v3.x of Python) or platform (Linux, Windows, etc) that should be used in the lookup procedure?
Yes. It is possible to specify the version of target JVM. [example](https://maven.apache.org/plugins/maven-compiler-plugin/examples/set-compiler-source-and-target.html)

---

#### Will users need the ability to configure language or other constraints using Renovate config?

## Artifacts

#### Are lock files or checksum files used? Mandatory?
No
---

#### If so, what tool and exact commands should be used if updating 1 or more package versions in a dependency file?

---

#### If applicable, describe how the tool maintains a cache and if it can be controlled via CLI or env? Do you recommend the cache be kept or disabled/ignored?

---

#### If applicable, what command should be used to generate a lock file from scratch if you already have a package file? This will be used for "lock file maintenance".

## Other

#### Is there anything else to know about this package manager?
