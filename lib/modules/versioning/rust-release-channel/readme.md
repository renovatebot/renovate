This versioning scheme handles Rust release channel identifiers as used by rustup and other Rust-related tools.

### Supported Formats

#### Channel Names (Ranges)

- `stable` - matches any stable release (e.g., `1.82.0`)
- `beta` - matches any beta release (e.g., `1.83.0-beta.5`)
- `nightly` - matches any dated nightly (requires date, e.g., `nightly-2025-11-24`)

#### Versioned Releases

- Full versions: `1.82.0`, `1.83.0-beta.5`
- Version ranges: `1.82` (`1.82.0` <= version < `1.83.0`)
- Beta ranges: `1.83.0-beta` (matches all beta versions for `1.83.0`)

#### Dated Nightlies

- `nightly-2025-11-24` - specific nightly release from a date
- `nightly-2015-05-15` - historical nightlies (pre-Rust 1.0)

### Compatibility Groups

- **Nightly versions** are only compatible with other nightlies
- **Stable and beta versions** are compatible with each other

This affects which updates Renovate will offer.

### Stability

Only final releases without prerelease suffixes are considered "stable":

- `1.82.0` → stable
- `1.83.0-beta.5` → not stable
- `nightly-2025-11-24` → not stable

### Range Strategies

#### `pin`

Always pins to the exact new version:

- `stable` → `1.83.0`
- `nightly` → `nightly-2025-11-24`

#### `replace`

Maintains the format style of the current value:

- `stable` → `stable`
- `beta` → `beta`
- `nightly` → `nightly`
- `nightly-2025-11-23` → `nightly-2025-11-24`
- `1.82` → `1.83`
- `1.82.0` → `1.83.0`
- `1.83.0-beta` → `1.84.0-beta`
- `1.83.0-beta.1` → `1.83.0-beta.5`

### Major/Minor/Patch Extraction

For versioned releases:

- Extract directly from semver (e.g., `1.82.0` → major=1, minor=82, patch=0)
- Ignore prerelease part (e.g., `1.83.0-beta.5` → major=1, minor=83, patch=0)

For nightlies:

- Before 2015-05-15 (Rust 1.0 release): major=0, minor=null, patch=null
- After 2015-05-15: major=1, minor=null, patch=null

### Resources

- [Rust Toolchain Concepts](https://rust-lang.github.io/rustup/concepts/toolchains.html)
- [Rust Release History](https://releases.rs/)
