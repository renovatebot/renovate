# Work in Progress

## Overview

#### Name of package manager

Bundler

#### What language does this support?

Ruby

#### Does that language have other (competing?) package managers?

No

## Package File Detection

#### What type of package files and names does it use?

Package - gem. Name - Gemfile or gemspec

#### What [fileMatch](https://renovatebot.com/docs/configuration-options/#filematch) pattern(s) should be used?

`/Gemfile|.gemspec/`

#### Is it likely that many users would need to extend this pattern for custom file names?

No

#### Is the fileMatch pattern likely to get many "false hits" for files that have nothing to do with package management?

No

## Parsing and Extraction

#### Can package files have "local" links to each other that need to be resolved?

No

#### Is there reason why package files need to be parsed together (in serial) instead of independently?

No

#### What format/syntax is the package file in? e.g. JSON, TOML, custom?

Ruby syntax

#### How do you suggest parsing the file? Using an off-the-shelf parser, using regex, or can it be custom-parsed line by line?

I'm thinking about to use something that can transform ruby code to abstract syntax tree

#### Does the package file structure distinguish between different "types" of dependencies? e.g. production dependencies, dev dependencies, etc?

Yes, but not sure that it's relevant to Renovate purposes

#### List all the sources/syntaxes of dependencies that can be extracted:

Bundler can use multiple gem sources

#### Describe which types of dependencies above are supported and which will be implemented in future:

## Versioning

#### What versioning scheme do the package files use?

Semantic version scheme

#### Does this versioning scheme support range constraints, e.g. ^1.0.0 or 1.x?

Yes

#### Is this package manager used for applications, libraries, or both? If both, is there a way to tell which is which?

Yes

#### If ranges are supported, are there any cases when Renovate should pin ranges to exact versions if rangeStrategy=auto?

No

## Lookup

#### Is a new datasource required? Provide details

No

#### Will users need the capability to specify a custom host/registry to look up? Can it be found within the package files, or within other files inside the repository, or would it require Renovate configuration?

Yes, I think it can be achived in both ways.

#### Do the package files contain any "constraints" on the parent language (e.g. supports only v3.x of Python) or platform (Linux, Windows, etc) that should be used in the lookup procedure?

No

#### Will users need the ability to configure language or other constraints using Renovate config?

No

## Artifacts

#### Are lock files or checksum files used? Mandatory?

File - Gemfile.lock. Mandatory - Yes

#### If so, what tool and exact commands should be used if updating 1 or more package versions in a dependency file?

bundle update

#### If applicable, describe how the tool maintains a cache and if it can be controlled via CLI or env? Do you recommend the cache be kept or disabled/ignored?

Bundler has own cache wich can be specified via --local or --no-cache flags

#### If applicable, what command should be used to generate a lock file from scratch if you already have a package file? This will be used for "lock file maintenance".

If Gemfile.lock missing than bundle check can be used, ff preset then bundle check.

## Other

#### Is there anything else to know about this package manager?

No
