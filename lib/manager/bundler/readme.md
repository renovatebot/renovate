## Overview

#### Name of package manager

[Bundler](https://bundler.io/)

---

#### What language does this support?

Ruby

---

#### Does that language have other (competing?) package managers?

No

## Package File Detection

#### What type of package files and names does it use?

Gemfile or gemspec

---

#### What [fileMatch](https://renovatebot.com/docs/configuration-options/#filematch) pattern(s) should be used?

['(^|/)(Gemfile|.gemspec)$']

---

#### Is it likely that many users would need to extend this pattern for custom file names?

Not likely

---

#### Is the fileMatch pattern likely to get many "false hits" for files that have nothing to do with package management?

No

## Parsing and Extraction

#### Can package files have "local" links to each other that need to be resolved?

No local/file references - only to hosted sources like RubyGems

---

#### Is there reason why package files need to be parsed together (in serial) instead of independently?

No, if a project has more than one Bundler file then they can be parsed and processed independently.

---

#### What format/syntax is the package file in? e.g. JSON, TOML, custom?

Ruby syntax

---

#### How do you suggest parsing the file? Using an off-the-shelf parser, using regex, or can it be custom-parsed line by line?

It would be quite challenging to parse all the allowable Ruby syntax without using Ruby itself, unless you decide to support only a subset of allowable syntax.

---

#### Does the package file structure distinguish between different "types" of dependencies? e.g. production dependencies, dev dependencies, etc?

Yes, Bundler allows "groups" but these are only for the convenience of users and should not affect the results that Renovate produces.

---

#### List all the sources/syntaxes of dependencies that can be extracted:

Most are regular gem sources.

> Git repositories are also valid gem sources, as long as the repo contains one or more valid gems. Specify what to check out with `:tag`, `:branch`, or `:ref`. The default is the `master` branch.

Example:

```
gem 'nokogiri', :git => 'https://github.com/tenderlove/nokogiri.git', :branch => '1.4'
```

More information: https://bundler.io/v1.5/gemfile.html

---

#### Describe which types of dependencies above are supported and which will be implemented in future:

Skip git dependencies initially. Then support git tags, and then add a github branch datasource and support git branch-based after.

## Versioning

#### What versioning scheme do the package files use?

Semantic version scheme

---

#### Does this versioning scheme support range constraints, e.g. `^1.0.0` or `1.x`?

Yes, but different syntax to npm's semver.

---

#### Is this package manager used for applications, libraries, or both? If both, is there a way to tell which is which?

Used for both.

---

#### If ranges are supported, are there any cases when Renovate should pin ranges to exact versions if rangeStrategy=auto?

Application pinning to be determined later.

## Lookup

#### Is a new datasource required? Provide details

Yes, a RubyGems datasource is required to be added.

---

#### Will users need the capability to specify a custom host/registry to look up? Can it be found within the package files, or within other files inside the repository, or would it require Renovate configuration?

Yes, to be specified from within Gemfile (there are multiple ways to define source, e.g. file-wide or per-dependency).

---

#### Do the package files contain any "constraints" on the parent language (e.g. supports only v3.x of Python) or platform (Linux, Windows, etc) that should be used in the lookup procedure?

Yes, Ruby version.

---

#### Will users need the ability to configure language or other constraints using Renovate config?

No

## Artifacts

#### Are lock files or checksum files used? Mandatory?

File - Gemfile.lock. Mandatory - Yes

---

#### If so, what tool and exact commands should be used if updating 1 or more package versions in a dependency file?

bundle update

---

#### If applicable, describe how the tool maintains a cache and if it can be controlled via CLI or env? Do you recommend the cache be kept or disabled/ignored?

Bundler has own cache wich can be specified via --local or --no-cache flags. To be determined which works best for Renovate.

---

#### If applicable, what command should be used to generate a lock file from scratch if you already have a package file? This will be used for "lock file maintenance".

If Gemfile.lock missing than bundle check can be used.

## Other

#### Is there anything else to know about this package manager?

No
