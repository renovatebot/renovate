Renovate can update Puppetfiles and the `dependencies` of a Puppet module's `metadata.json`.

### How it works

Renovate:

1. Searches each repository for any `Puppetfile` and `metadata.json` files
1. Extracts dependencies from the relevant sections of the `Puppetfile`, or from the `dependencies` array of the `metadata.json`
1. Resolves the dependency on the default forge: `https://forgeapi.puppetlabs.com`, or on a user-defined forge
1. Creates a PR that updates the `Puppetfile` or `metadata.json`

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

### Supported `metadata.json` formats

Renovate reads the `dependencies` array of a Puppet module's `metadata.json`:

```json title="metadata.json"
{
  "name": "example-mymodule",
  "version": "1.2.3",
  "dependencies": [
    {
      "name": "puppetlabs/stdlib",
      "version_requirement": ">= 9.0.0 < 10.0.0"
    },
    {
      "name": "puppetlabs-concat",
      "version_requirement": "9.x"
    }
  ]
}
```

- `name` may use either the `author/module` or the `author-module` form
- `version_requirement` is compared using the `npm` versioning, which supports the version range syntax used by Puppet
- dependencies without a `version_requirement` are skipped

The module's own top-level `version` field is not updated.

By default (`rangeStrategy=auto`) Renovate _widens_ `metadata.json` ranges, so `>= 9.0.0 < 10.0.0` becomes `>= 9.0.0 < 11.0.0` when a new major version is released.
Set `rangeStrategy` to `bump`, `replace` or `pin` if you want different behavior.
