This datasource fetches the latest nightly Rust toolchain releases from the <https://github.com/rust-lang/rustup-components-history> repository:

```
https://rust-lang.github.io/rustup-components-history/x86_64-unknown-linux-gnu/rust.json
```

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
- **Platform-Specific**: Currently hardcoded to `x86_64-unknown-linux-gnu`. This could be made configurable in the future, if needed.

### Caching

Results are cached for 60 minutes by default.
