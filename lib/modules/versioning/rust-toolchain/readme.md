The [channel](https://rust-lang.github.io/rustup/overrides.html#channel) setting in [rust-toolchain.toml](https://rust-lang.github.io/rustup/overrides.html#the-toolchain-file) specifies which Rust toolchain to use. The value is a string in the following form:

```
<channel>       = stable|beta|nightly|<versioned>[-<prerelease>]
<versioned>     = <major.minor>|<major.minor.patch>
<prerelease>    = beta[.<number>]
```

Named release channels (`stable`, `beta`, `nightly`) are left unchanged, as are pre-release versions (e.g. `1.82.0-beta.1`).

Versions without a patch version set (e.g. `1.82`) are similar to NPM's [tilde operator](https://docs.npmjs.com/cli/v6/using-npm/semver#tilde-ranges-123-12-1) (e.g. ~1.82.0). In other words, patch level changes are allowed. While version with a patch version set (e.g. `1.82.1`) specify a single exact version, similar to NPM's `=` operator.
