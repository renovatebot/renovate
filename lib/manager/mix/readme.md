## Overview

#### Name of package manager

Mix

#### Implementation status

Implemented

#### What language does this support?

Elixir

#### Does that language have other (competing?) package managers?

Mix is main Elixir build tool

## Package File Detection

#### What type of package files and names does it use?

mix.exs

#### What [fileMatch](https://renovatebot.com/docs/configuration-options/#filematch) pattern(s) should be used?

File names are static

#### Is it likely that many users would need to extend this pattern for custom file names?

No, file names are static

#### Is the fileMatch pattern likely to get many "false hits" for files that have nothing to do with package management?

No

## Parsing and Extraction

#### Can package files have "local" links to each other that need to be resolved?

No

#### Is there reason why package files need to be parsed together (in serial) instead of independently?

No

#### What format/syntax is the package file in? e.g. JSON, TOML, custom?

Custom

#### How do you suggest parsing the file? Using an off-the-shelf parser, using regex, or can it be custom-parsed line by line?

RegExp

#### Does the package file structure distinguish between different "types" of dependencies? e.g. production dependencies, dev dependencies, etc?

No

#### List all the sources/syntaxes of dependencies that can be extracted:

    ```
    defp deps() do
        [
            {:ecto, "~> 2.0"},
            {:postgrex, "~> 0.8.1"},
            {:cowboy, github: "ninenines/cowboy"},
        ]
    ```

#### Describe which types of dependencies above are supported and which will be implemented in future:

All that are mentioned

## Versioning

#### What versioning scheme do the package files use?

SemVer 2.0 schema

#### Does this versioning scheme support range constraints, e.g. `^1.0.0` or `1.x`?

Yes, ([doc link](https://hexdocs.pm/elixir/Version.html))

#### Is this package manager used for applications, libraries, or both? If both, is there a way to tell which is which?

There are only modules that can be used as apps and libs

#### If ranges are supported, are there any cases when Renovate should pin ranges to exact versions if rangeStrategy=auto?

Supported following ranges of hex datasource:

- ~> 1.0.0/ ~>1.0
- and/or ranges

## Lookup

#### Is a new datasource required? Provide details

Implemented ([here]https://github.com/renovatebot/renovate/issues/3043())

#### Will users need the capability to specify a custom host/registry to look up? Can it be found within the package files, or within other files inside the repository, or would it require Renovate configuration?

Mix supports dependencies hosted as git repositories:

```
 {:cowboy, github: "ninenines/cowboy"},
```

#### Do the package files contain any "constraints" on the parent language (e.g. supports only v3.x of Python) or platform (Linux, Windows, etc) that should be used in the lookup procedure?

No

#### Will users need the ability to configure language or other constraints using Renovate config?

No

## Artifacts

#### Are lock files or checksum files used? Mandatory?

Lock files are mix.lock and they are mandatory

#### If so, what tool and exact commands should be used if updating 1 or more package versions in a dependency file?

([mix deps.update](https://hexdocs.pm/mix/master/Mix.Tasks.Deps.Update.html))

#### If applicable, describe how the tool maintains a cache and if it can be controlled via CLI or env? Do you recommend the cache be kept or disabled/ignored?

Mix doesn't cache deps only put compiled files via mix deps.compile. Build files can be deleted via mix deps.clean --build

#### If applicable, what command should be used to generate a lock file from scratch if you already have a package file? This will be used for "lock file maintenance".

mix deps.get - gets dependencies and creates/updates .lock file
mix deps.uplock (--all) - deletes dependency in .lock file

## Other

Pm files can contain comments that can make a line with dep ignored

#### Is there anything else to know about this package manager?
