simply keeps Puppetfiles updated

### How It Works

1. Renovate searches in each repository for any `Puppetfile` files
1. Existing dependencies are extracted from the relevant sections of the file
1. Renovate resolves the dependency on the provided forges (or uses `https://forgeapi.puppetlabs.com` as default)
1. A PR is created with `Puppetfile` updated in the same commit
1. If the source repository has either a "changelog" file or uses GitHub releases, then Release Notes for each version will be embedded in the generated PR

### supported Puppetfile formats

the manager extracts the deps from one Puppetfile

the Puppetfile supports at the moment different ways to configure forges

1. no forge defined

   ```ruby
   mod 'puppetlabs/apt', '8.3.0'
   mod 'puppetlabs/apache', '7.0.0'
   ```

2. one forge defined: `forge "https://forgeapi.puppetlabs.com"`

   ```ruby
   forge "https://forgeapi.puppetlabs.com"

   mod 'puppetlabs/apt', '8.3.0'
   mod 'puppetlabs/apache', '7.0.0'
   mod 'puppetlabs/concat', '7.1.1'
   ```

3. multiple forges defined

   ```ruby
   forge "https://forgeapi.puppetlabs.com"

   mod 'puppetlabs/apt', '8.3.0'
   mod 'puppetlabs/apache', '7.0.0'
   mod 'puppetlabs/concat', '7.1.1'

   # private forge
   forge "https://forgeapi.example.com"

   mod 'example/infra', '3.3.0'
   ```

4. github based version

   ```ruby
   # tag based
   mod 'example/standalone_jar',
      :git => 'git@gitlab.example.de:puppet/example-standalone_jar',
      :tag => '0.9.0'
   ```

5. git based version

   ```ruby
   # tag based
   mod 'stdlib',
    :git => 'git@gitlab.com:example/project_stdlib.git',
    :tag => '5.0.0'
   ```

### possible improvements

#### further git-support

usually you can add the versions to a forge and use the already provided
way of updating

```ruby
# branch based
mod 'example/samba',
    :git    => 'https://github.com/example/puppet-samba',
    :branch => 'stable_version'
```

```ruby
# ref based
mod 'example/samba',
    :git => 'https://github.com/example/puppet-samba',
    :ref => 'stable_version'
```
