## Overview

#### Name of package manager

[Composer](https://getcomposer.org/)

---

#### What language does this support?

PHP

---

#### Does that language have other (competing?) package managers?

No, everyone uses Composer

## Package File Detection

#### What type of package files and names does it use?

`composer.json` is used in most cases, but [Composer allows alternative `.json` file names](https://getcomposer.org/doc/03-cli.md#composer).

---

#### What [fileMatch](https://renovatebot.com/docs/configuration-options/#filematch) pattern(s) should be used?

`['(^|/)([\\w-]*)composer.json$']`

---

#### Is it likely that many users would need to extend this pattern for custom file names?

Unlikely - nearly everybody would include the string "composer" in the JSON file name.

---

#### Is the fileMatch pattern likely to get many "false hits" for files that have nothing to do with package management?

There are unlikely to be too many JSON files with "composer" in the name that aren't Composer package files.

## Parsing and Extraction

#### Can package files have "local" links to each other that need to be resolved?

If a repository has more than one Composer package file then they can be parsed independently. However, one composer file may point to another using a relative path, so they should all be written to disk first before any are extracted.

#### Is there reason why package files need to be parsed together (in serial) instead of independently?

Only if they are not written to disk first before parsing.

---

#### What format/syntax is the package file in? e.g. JSON, TOML, custom?

JSON

---

#### How do you suggest parsing the file? Using an off-the-shelf parser, using regex, or can it be custom-parsed line by line?

Parse the file using `JSON.parse`.

---

#### Does the package file structure distinguish between different "types" of dependencies? e.g. production dependencies, dev dependencies, etc?

Composer files split dependencies into `requires` and `requires-dev`. Both are optional.

---

#### List all the sources/syntaxes of dependencies that can be extracted:

In Composer the syntax for dependencies is always `"scope/package"` regardless of its source. The lookup approach is then determined by the values in `repositories`, if present.

---

#### Describe which types of dependencies above are supported and which will be implemented in future:

- Packagist.org dependencies: Supported
- "composer" hosts with plain `packages.json`: Supported
- "composer" hosts with [`provider-includes` and `providers-url`](https://getcomposer.org/doc/05-repositories.md#provider-includes-and-providers-url): Supported
- Satis hosts: Supported
- Repositories of type "path": Not supported yet
- Repositories of type "package": Not supported yet
- Repositories of type "vcs": Not supported yet
- Dependencies with value `"*"`: Skipped

## Versioning

#### What versioning scheme do the package files use?

Composer files use semver 2.0. ([details](https://getcomposer.org/doc/articles/versions.md))

[online checker](https://semver.mwl.be)

---

#### Does this versioning scheme support range constraints, e.g. `^1.0.0` or `1.x`?

Yes, it has support for many range types, documented in the link above.

---

#### Is this package manager used for applications, libraries, or both? If both, is there a way to tell which is which?

Both. The `type` field is often included at the root of a composer file and can be used to infer which type, although it's not possible to always be 100% sure.

The following types should be considered as library: 'library', 'metapackage', 'composer-plugin'.

---

#### If ranges are supported, are there any cases when Renovate should pin ranges to exact versions if rangeStrategy=auto?

TODO

## Lookup

#### Is a new datasource required? Provide details

Yes, for Packagist and composer-compatible lookups.

Details: https://getcomposer.org/doc/05-repositories.md#hosting-your-own

---

#### Will users need the capability to specify a custom host/registry to look up? Can it be found within the package files, or within other files inside the repository, or would it require Renovate configuration?

Yes. There is an optional [`repositories`](https://getcomposer.org/doc/05-repositories.md#repository) field allowed at the root of any composer file. There should usually be no need to override this by config.

---

#### Do the package files contain any "constraints" on the parent language (e.g. supports only v3.x of Python) or platform (Linux, Windows, etc) that should be used in the lookup procedure?

`require` and `require-dev` support references to specific PHP versions and PHP extensions a project needs to run successfully.

Example:

```
{
    "require" : {
        "php" : "^5.5 || ^7.0",
        "ext-mbstring": "*"
    }
}
```

[(ref)](https://getcomposer.org/doc/04-schema.md#package-links)

This `php` constraint needs to be compared against the `php` field (if present) in the package's metadata on Packagist/etc.

---

#### Will users need the ability to configure language or other constraints using Renovate config?

It should be a rare case.

## Artifacts

#### Are lock files or checksum files used? Mandatory?

Yes, they will be named the same as the package file, e.g. `composer.lock`.

The are optional but heavily used.

---

#### If so, what tool and exact commands should be used if updating 1 or more package versions in a dependency file?

The CLI tool `composer` needs to be used.

To update a specific dependency, you can:

1. Update the dependency version(s) in `composer.json`
2. Run `composer update dep1 dep2` where `dep1` and `dep2` are the two dependencies having been updated in `composer.json`

This will unfortunately result in all dependencies being downloaded, but at least only the specified dependencies will be updated in the lock file.

---

#### If applicable, describe how the tool maintains a cache and if it can be controlled via CLI or env? Do you recommend the cache be kept or disabled/ignored?

As described above, `composer update` will download all packages in the package file. The env variable `COMPOSER_CACHE_DIR` can be used to control where the cache is kept. It is recommended to keep the cache between Renovate runs.

---

#### If applicable, what command should be used to generate a lock file from scratch if you already have a package file? This will be used for "lock file maintenance".

`composer install`

## Other

#### Is there anything else to know about this package manager?

No
