# String Pattern Matching - Regex or Glob

Renovate string matching syntax for some configuration options allows the user to choose between [`minimatch`](https://github.com/isaacs/minimatch) glob patterns, including exact strings matches, or regular expression (regex) patterns.

## Regex matching

Users can choose to use regex patterns by starting the pattern string with `/` and ending with `/` or `/i`.
Regex patterns are evaluated with case sensitivity unless the `i` flag is specified.

Renovate uses the [`re2`](https://github.com/google/re2) library for regex matching, which is not entirely the same syntax/support as the full regex specification.
For a full list of re2 syntax, see [the re2 syntax wiki page](https://github.com/google/re2/wiki/Syntax).

Example regex patterns:

- `/^abc/` is a regex pattern matching any string starting with lower-case `abc`.
- `^abc/i` is a regex pattern matching any string starting with `abc` in lower or upper case, or a mix.

If you want to test your patterns interactively online, we recommend [regex101.com](https://regex101.com/?flavor=javascript&flags=ginst).

## Glob matching

If the string provided is not a regex pattern then it will be treated as a glob pattern and parsed using the `minimatch` library.
Although glob patterns were designed originally for file name matching, many users find glob syntax easier to understand than regex so prefer it.

Glob patterns are evaluated with case _insensitivity_ and this is not configurable, so if you require a case-sensitive pattern then you should use a regex pattern instead.

Examples:

- `abc123` matches `abc123` exactly, or `AbC123`.
- `abc*` matches `abc`, `abc123`, `ABCabc`, etc.

## Usage in Renovate configuration options

Renovate has matured its approach to string pattern matching over time, but this means that existing configurations may have a mix of approaches and not be entirely consistent with each other.

The configuration options which support this "regex or glob" syntax have it noted in their documentation with a link to this page for more details.
