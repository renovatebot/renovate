Renovate can update Puppetfiles.

### How it works

1. Renovate searches in each repository for any `Puppetfile` files
1. Existing dependencies are extracted from the relevant sections of the file
1. Renovate resolves the dependency on the provided forges (or uses `https://forgeapi.puppetlabs.com` as default)
1. A PR is created with `Puppetfile` updated in the same commit
1. If the source repository has either a "changelog" file or uses GitHub releases, then Release Notes for each version will be embedded in the generated PR

### Supported Puppetfile formats

The `puppetfile` manager extracts the dependencies from one Puppetfile.
You can define a forge in your `puppetfile` in these ways:

- No forge
- One forge
- Multiple forges
- GitHub-based forge
- Git-based forge

For example:

```ruby title="No forge"
mod 'puppetlabs/apt', '8.3.0'
mod 'puppetlabs/apache', '7.0.0'
```

```ruby title="One forge"
forge "https://forgeapi.puppetlabs.com"

mod 'puppetlabs/apt', '8.3.0'
mod 'puppetlabs/apache', '7.0.0'
mod 'puppetlabs/concat', '7.1.1'
```

```ruby title="Multiple forges"
forge "https://forgeapi.puppetlabs.com"

mod 'puppetlabs/apt', '8.3.0'
mod 'puppetlabs/apache', '7.0.0'
mod 'puppetlabs/concat', '7.1.1'

# Private forge
forge "https://forgeapi.example.com"

mod 'example/infra', '3.3.0'
```

```ruby title="GitHub-based forge, tag based"
mod 'example/standalone_jar',
    :git => 'git@gitlab.example.de:puppet/example-standalone_jar',
    :tag => '0.9.0'
```

```ruby title="Git-based forge, tag based"
mod 'stdlib',
    :git => 'git@gitlab.com:example/project_stdlib.git',
    :tag => '5.0.0'
```

```ruby title="Git-based forge, branch based"
mod 'example/samba',
    :git    => 'https://github.com/example/puppet-samba',
    :branch => 'stable_version'
```

```ruby title="Git-based forge, ref based"
mod 'example/samba',
    :git => 'https://github.com/example/puppet-samba',
    :ref => 'stable_version'
```
