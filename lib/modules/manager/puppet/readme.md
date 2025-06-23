Renovate can update Puppetfiles.

### How it works

Renovate:

1. Searches each repository for any `Puppetfile` files
1. Extracts dependencies from the relevant sections of the `Puppetfile`
1. Resolves the dependency on the default forge: `https://forgeapi.puppetlabs.com`, or on a user-defined forge
1. Creates a PR that updates the `Puppetfile`

Finally, if the source repository has a "changelog" file _or_ uses GitHub releases, then Renovate puts the changelogs for each version in its PR.

### Supported Puppetfile formats

The `puppet` manager extracts the dependencies from one Puppetfile.
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
