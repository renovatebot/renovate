## Overview

#### Name of package manager

[Cargo](https://doc.rust-lang.org/cargo/index.html)

---

#### What language does this support?

Rust

---

#### Does that language have other (competing?) package managers?

No

## Package File Detection

#### What type of package files and names does it use?

It uses exclusively `Cargo.toml` files.

---

#### What [fileMatch](https://renovatebot.com/docs/configuration-options/#filematch) pattern(s) should be used?

---

#### Is it likely that many users would need to extend this pattern for custom file names?

---

#### Is the fileMatch pattern likely to get many "false hits" for files that have nothing to do with package management?

## Parsing and Extraction

#### Can package files have "local" links to each other that need to be resolved?

It is possible to have local dependencies, by specifying a file path.

---

#### Is there reason why package files need to be parsed together (in serial) instead of independently?

No a single Cargo.toml file specifies a single package.

---

#### What format/syntax is the package file in? e.g. JSON, TOML, custom?

TOML

---

#### How do you suggest parsing the file? Using an off-the-shelf parser, using regex, or can it be custom-parsed line by line?

Cargo.toml files are custom-parsed line by line.

---

#### Does the package file structure distinguish between different "types" of dependencies? e.g. production dependencies, dev dependencies, etc?

There are [build-dependencies], [dev-dependencies], and [dependencies] sections.
Build dependencies are only required at compile time by the
build script see [reference](https://doc.rust-lang.org/cargo/reference/build-scripts.html).
Dev dependencies are only required by package's tests and examples
see [reference](https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html#development-dependencies).
All these dependency types are treated similarly.

---

#### List all the sources/syntaxes of dependencies that can be extracted:

Normal dependencies of the format:

```toml
[dependencies]
dep1 = "1.2.3"
dep2 = "=2.3.4"
```

Inline table dependencies:

```toml
[dependencies]
dep1 = { version = "1.2.3", path = "./foo/bar/" }
dep2 = { default-features = false, version = "=2.3.4" }
```

Standard table dependencies:

```toml
[dependencies.dep1]
version = "5.2.8"
default-features = false # Comment
features = ["feat1", "feat2"]
```

---

#### Describe which types of dependencies above are supported and which will be implemented in future:

All 3 possible syntaxes of dependencies are supported by the existing `extractPackageFile` function.
Different types of dependencies [dev-dependencies], [build-dependencies], and [dependencies] are treated the same.

## Versioning

#### What versioning scheme do the package files use?

Semantic versioning.

---

#### Does this versioning scheme support range constraints, e.g. `^1.0.0` or `1.x`?

Yes.

---

#### Is this package manager used for applications, libraries, or both? If both, is there a way to tell which is which?

Both. Libraries have a `lib.rs` file in `src` directory and no `main.rs`, binaries must have a `main.rs` file in `src`.

---

#### If ranges are supported, are there any cases when Renovate should pin ranges to exact versions if rangeStrategy=auto?

It isn't clear yet.
NOTE: A `cargo` version like 1.3.4 is equivalent to npm version of ^1.3.4, so pinning to an exact version would require
setting version to =1.3.4

## Lookup

#### Is a new datasource required? Provide details

New crate versions can be fetched from [crates.io](crates.io).

---

#### Will users need the capability to specify a custom host/registry to look up? Can it be found within the package files, or within other files inside the repository, or would it require Renovate configuration?

Cargo supports dependencies hosted as git repositories at custom URL, the url is specified like:

```toml
[dependencies]
rand = { git = "https://github.com/rust-lang-nursery/rand" }
```

see [reference](https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html#specifying-dependencies-from-git-repositories)

---

#### Do the package files contain any "constraints" on the parent language (e.g. supports only v3.x of Python) or platform (Linux, Windows, etc) that should be used in the lookup procedure?

It is possible to have platform specific dependencies, but it doesn't affect the lookup procedure.

see [reference](https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html#platform-specific-dependencies)

---

#### Will users need the ability to configure language or other constraints using Renovate config?

Cargo only deals with Rust projects.

## Artifacts

#### Are lock files or checksum files used? Mandatory?

Yes, lock files are used, and checksums are recorded in lock files.
When a crate is built a `Cargo.lock` file is always generated.

see [reference](https://doc.rust-lang.org/cargo/guide/cargo-toml-vs-cargo-lock.html)

---

#### If so, what tool and exact commands should be used if updating 1 or more package versions in a dependency file?

Update dep1:

```sh
cargo update -p dep1
```

Update all dependencies:

```sh
cargo update
```

---

#### If applicable, describe how the tool maintains a cache and if it can be controlled via CLI or env? Do you recommend the cache be kept or disabled/ignored?

Cargo shares build artifacts among all the packages of a single workspace.
Today, Cargo does not share build results across different workspaces,
but a similar result can be achieved by using a third party tool, [sccache](https://github.com/mozilla/sccache).
see [reference](https://doc.rust-lang.org/cargo/guide/build-cache.html)

---

#### If applicable, what command should be used to generate a lock file from scratch if you already have a package file? This will be used for "lock file maintenance".

```sh
cargo update
```

## Other

#### Is there anything else to know about this package manager?

`cargo update` or a `cargo update -p dep1` command updates Cargo.lock file in current crate inplace.
