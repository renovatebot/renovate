This manager can be used to update the Rust toolchain version in `rust-toolchain.toml` and `rust-toolchain` files.

It supports both the TOML format and the legacy plain-text format as specified in the [Rust toolchain documentation](https://rust-lang.github.io/rustup/overrides.html#the-toolchain-file).

### Version pinning

If you'd like to pin your toolchain to a particular version, the following configuration can be applied:

```json
{
  "packageRules": [
    {
      "matchDepTypes": ["toolchain"],
      "rangeStrategy": "pin"
    }
  ]
}
```

### Supported renovations

- `1.90.0` → `2.0.0` (major version updates)
- `1.90.0` → `1.91.0` (minor version updates)
- `1.90.0` → `1.90.1` (patch version updates)
- `nightly-2025-10-10` → `nightly-2025-10-11` (nightly version updates)

With `rangeStrategy: replace`:

- `1.90` → `2.0` (major range updates)
- `1.90` → `1.91` (minor range updates)

With `rangeStrategy: pin`:

- `1.90` → `1.90.0` (range pinning)

_Note: The version numbers shown above are just examples for illustration purposes._
