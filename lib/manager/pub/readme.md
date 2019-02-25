## Overview

#### Name of package manager

[pub](https://pub.dartlang.org/)

---

#### What language does this support?

Dart / Flutter SDK

---

#### Does that language have other (competing?) package managers?

No.

## Package File Detection

#### What type of package files and names does it use?

_pubspec.yaml_

---

#### What [fileMatch](https://renovatebot.com/docs/configuration-options/#filematch) pattern(s) should be used?

`^pubspec\.yaml`

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

YAML

---

#### How do you suggest parsing the file? Using an off-the-shelf parser, using regex, or can it be custom-parsed line by line?

Use YAML parser like [JS-YAML](https://github.com/nodeca/js-yaml)

---

#### Does the package file structure distinguish between different "types" of dependencies? e.g. production dependencies, dev dependencies, etc?

Yes, `dependencies` and `dev-dependencies`.

More details in: <https://www.dartlang.org/tools/pub/dependencies>

Example from <https://github.com/brianegan/flutter_architecture_samples/blob/master/example/firestore_redux/pubspec.yaml>:

```yaml
environment:
  sdk: '>=2.0.0 <3.0.0'

dependencies:
  meta: '>=1.1.0 <2.0.0'
  redux: ^3.0.0
  flutter_redux: ^0.5.0
  flutter:
    sdk: flutter
  flutter_architecture_samples:
    path: ../../
  firebase_flutter_repository:
    path: ../firebase_flutter_repository

dev_dependencies:
  test: ^1.3.0
  mockito: ^3.0.0
  flutter_driver:
    sdk: flutter
  flutter_test:
    sdk: flutter
  integration_tests:
    path: ../integration_tests
  todos_repository_flutter:
    path: ../todos_repository_flutter
```

---

#### List all the sources/syntaxes of dependencies that can be extracted:

- [**SDK**](https://www.dartlang.org/tools/pub/dependencies#sdk)
  ```yaml
  dependencies:
    flutter_driver:
      sdk: flutter
      version: ^0.0.1
  ```

- [**Version constraints**](https://www.dartlang.org/tools/pub/dependencies#version-constraints)
  ```yaml
  dependencies:
    meta: '>=1.1.0 <2.0.0'
    flutter_redux: 0.5.0
  ```

- [**Caret syntax**](https://www.dartlang.org/tools/pub/dependencies#caret-syntax)
  ```yaml
  dependencies:
    redux: ^3.0.0
  ```

- [**Git packages**](https://www.dartlang.org/tools/pub/dependencies#git-packages)
  ```yaml
  dependencies:
    kittens:
      git: git://github.com/munificent/kittens.git
  ```
  ```yaml
  dependencies:
    kittens:
      git: git@github.com:munificent/kittens.git
  ```
  ```yaml
  dependencies:
    kittens:
      git:
        url: git://github.com/munificent/kittens.git
        ref: some-branch
  ```
  ```yaml
  dependencies:
    kittens:
      git:
        url: git://github.com/munificent/cats.git
        path: path/to/kittens
  ```

- [**Path packages**](https://www.dartlang.org/tools/pub/dependencies#path-packages)
  ```yaml
  dependencies:
    transmogrify:
      path: /Users/me/transmogrify
  ```

- [**Hosted packages**](https://www.dartlang.org/tools/pub/dependencies#hosted-packages)
  ```yaml
  dependencies:
    transmogrify:
      hosted:
        name: transmogrify
        url: http://your-package-server.com
      version: ^1.4.0
  ```

---

#### Describe which types of dependencies above are supported and which will be implemented in future:

All

## Versioning

#### What versioning scheme do the package files use?

<https://www.dartlang.org/tools/pub/dependencies>

---

#### Does this versioning scheme support range constraints, e.g. `^1.0.0` or `1.x`?

Yes

---

#### Is this package manager used for applications, libraries, or both? If both, is there a way to tell which is which?

Both. No.

---

#### If ranges are supported, are there any cases when Renovate should pin ranges to exact versions if rangeStrategy=auto?

Dev dependencies can always be pinned.

## Lookup

#### Is a new datasource required? Provide details

Not sure.

---

#### Will users need the capability to specify a custom host/registry to look up? Can it be found within the package files, or within other files inside the repository, or would it require Renovate configuration?

Yes

A registry can be specified in _pubspec.yaml_ with:

```yaml
dependencies:
  transmogrify:
    hosted:
      name: transmogrify
      url: http://your-package-server.com
    version: ^1.4.0
```

---

#### Do the package files contain any "constraints" on the parent language (e.g. supports only v3.x of Python) or platform (Linux, Windows, etc) that should be used in the lookup procedure?

Yes, SDK version can be defined using:

```yaml
environment:
  sdk: '>=2.0.0 <3.0.0'
```

---

#### Will users need the ability to configure language or other constraints using Renovate config?

No

## Artifacts

#### Are lock files or checksum files used? Mandatory?

Yes and yes, in _pubspec.lock_.

---

#### If so, what tool and exact commands should be used if updating 1 or more package versions in a dependency file?

Update all dependencies:

`flutter packages upgrade`

Update 1 dependency is not supported by a command. The package needs to be changed with the version number in _pubspec.yaml_ and then run `flutter packages upgrade`.

---

#### If applicable, describe how the tool maintains a cache and if it can be controlled via CLI or env? Do you recommend the cache be kept or disabled/ignored?

- `PUB_CACHE` environment variable defines the cache's location: <https://www.dartlang.org/tools/pub/environment-variables>

---

#### If applicable, what command should be used to generate a lock file from scratch if you already have a package file? This will be used for "lock file maintenance".

`flutter packages get`

## Other

#### Is there anything else to know about this package manager?

The information here refers to the Flutter SDK package manager, which is built on top of Dart's `pub` package manager but differs in some ways.

More info:
  - https://www.dartlang.org/tools/pub
  - https://flutter.dev/docs/development/packages-and-plugins/using-packages
