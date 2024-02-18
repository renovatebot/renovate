# String Pattern Matching - Regex or Glob

Renovate string matching syntax for some configuration options allows the user to choose between [`minimatch`](https://github.com/isaacs/minimatch) glob patterns, including exact strings matches, or regular expression (regex) patterns.

## Regex matching

Users can choose to use regex patterns by starting the pattern string with `/` or `!/` and ending with `/` or `/i`.
Regex patterns are evaluated with case sensitivity unless the `i` flag is specified.

Renovate uses the [`re2`](https://github.com/google/re2) library for regex matching, which is not entirely the same syntax/support as the full regex specification.
For a full list of re2 syntax, see [the re2 syntax wiki page](https://github.com/google/re2/wiki/Syntax).

Example regex patterns:

- `/^abc/` is a regex pattern matching any string starting with lower-case `abc`.
- `/^abc/i` is a regex pattern matching any string starting with `abc` in lower or upper case, or a mix.
- `!/^a/` is a regex pattern matching any string no starting with `a` in lower case.

If you want to test your patterns interactively online, we recommend [regex101.com](https://regex101.com/?flavor=javascript&flags=ginst).
Be aware that backslashes (`\`) of the resulting regex have to still be escaped e.g. `\n\s` --> `\\n\\s`. You can use the Code Generator in the sidebar and copy the regex in the generated "Alternative syntax" comment into JSON.

## Glob matching

If the string provided is not a regex pattern then it will be treated as a glob pattern and parsed using the `minimatch` library.
Although glob patterns were designed originally for file name matching, many users find glob syntax easier to understand than regex so prefer it.

Glob patterns are evaluated with case _insensitivity_ and this is not configurable, so if you require a case-sensitive pattern then you should use a regex pattern instead.

Examples:

- `abc123` matches `abc123` exactly, or `AbC123`.
- `abc*` matches `abc`, `abc123`, `ABCabc`, etc.

## Negative matching

Renovate has a specific approach to negative matching strings.

"Positive" matches are patterns (in glob or regex) which don't start with `!`.
"Negative" matches are patterns starting with `!` (e.g. `!/^a/` or `!b*`).

For an array of patterns to match, the following must be true:

- If any positive matches are included, at least one must match.
- If any negative matches are included, none must match.

For example, `["/^abc/", "!/^abcd/", "!/abce/"]` would match "abc" and "abcf" but not "foo", "abcd", "abce", or "abcdef".

## Usage in Renovate configuration options

Renovate has matured its approach to string pattern matching over time, but this means that existing configurations may have a mix of approaches and not be entirely consistent with each other.

The configuration options which support this "regex or glob" syntax have it noted in their documentation with a link to this page for more details.
