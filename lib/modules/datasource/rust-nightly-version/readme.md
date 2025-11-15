This datasource fetches the latest nightly Rust toolchain releases from the <https://github.com/rust-lang/rustup-components-history> repository:

```
https://rust-lang.github.io/rustup-components-history/x86_64-unknown-linux-gnu/rust.json
```

### Package Names and Targets

The datasource supports fetching data for all package names listed on <https://github.com/rust-lang/rustup-components-history>. The target architecture defaults to `x86_64-unknown-linux-gnu` but can be changed by using e.g. `rust?target=aarch64-apple-darwin` as the package name.

### API Response Format

The API returns a JSON object where keys are dates (`YYYY-MM-DD` format) and values are booleans indicating whether a nightly release is available for that date:

```json
{
  "2025-10-06": true,
  "2025-10-07": true,
  "2025-10-08": true,
  "2025-10-09": true,
  "2025-10-10": true,
  "2025-10-11": true,
  "2025-10-12": true,
  "last_available": "2025-10-12"
}
```

### Version Format

Versions are returned in the format `nightly-YYYY-MM-DD`, for example:

- `nightly-2025-10-12`
- `nightly-2025-10-11`

### Limitations

- **7-Day Window**: The API only provides information about the last seven nightly releases.

### Caching

Results are cached for 60 minutes by default.
