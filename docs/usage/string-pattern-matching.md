# String Pattern Matching - Regex or Glob

Renovate string matching syntax for some configuration options allows you, as user, to choose between:

- [`minimatch`](https://github.com/isaacs/minimatch) glob patterns, including exact strings matches
- regular expression (regex) patterns

In cases where there are potentially multiple _inputs_, e.g. managers can have multiple categories, then the matcher will return `true` if _any_ of them match.

## Special case: Match everything

The value `*` is a special case which means "match everything".
It is not valid to combine `*` with any other positive or negative match.

```json title="Example of valid wildcard use"
{
  "allowedEnv": ["*"]
}
```

```json title="Example of invalid wildcard use with additional match"
{
  "allowedEnv": ["*", "ABC"]
}
```

```json title="Example of invalid wildcard use with negation"
{
  "allowedEnv": ["*", "!ABC"]
}
```

In the latter case, the `*` can be ommitted and achieve the same thing.

## Regex matching

A valid regex pattern:

1. Starts with `/` or `!/`
1. Ends with `/` or `/i`

### Regex is case sensitive by default

By default, regex patterns are evaluated as case sensitive.
To ignore case sensitivity you must set the `i` flag, see the regex patterns table for an example.

### Renovate uses re2 syntax

Renovate uses the [`re2` library](https://github.com/google/re2) for regex matching.
`re2` is different from the full regex specification, because `re2` has a different sytax/support.

For the full `re2` syntax, read [the `re2` syntax wiki page](https://github.com/google/re2/wiki/Syntax).

### Example regex patterns

| Pattern   | Regex pattern explanation                                               |
| --------- | ----------------------------------------------------------------------- |
| `/^abc/`  | matches any string starting with lower-case `abc`                       |
| `/^abc/i` | matches any string starting with `abc` in lower or upper case, or a mix |
| `!/^a/`   | matches any string not starting with `a` in lower case                  |

### Use regex101 to test your patterns

If you want to test your patterns interactively online, we recommend [regex101.com](https://regex101.com/?flavor=javascript&flags=ginst).
You can use the Code Generator in the sidebar and copy the regex in the generated "Alternative syntax" comment into JSON.

<!-- prettier-ignore -->
!!! warning "Escape the backslashes from regex101"
    Before you copy/paste the regex from regex101 into your Renovate config, you must escape the backslashes (`\`) first.
    For example: `\n\s` --> `\\n\\s`.

## Glob matching

If the string provided is not a regex pattern then it will be treated as a glob pattern and parsed using the `minimatch` library.
Although glob patterns were designed originally for file name matching, many users find glob syntax easier to understand than regex so prefer it.

### Glob patterns always ignore casing

Glob patterns are always evaluated with case _insensitivity_ and you can not change this.
If you need a case-sensitive pattern you must use a regex pattern.

### Example glob patterns

| Pattern     | Glob pattern explanation                                     |
| ----------- | ------------------------------------------------------------ |
| `abc123`    | matches `abc123` exactly, or `AbC123`                        |
| `abc*`      | matches `abc`, `abc123`, `ABCabc`, but not `abc/def`         |
| `abc**/*`   | matches `abc/def` but not `abc`, `abcd`, or `abc/def/ghi`,   |
| `abc**/**`  | matches `abc/def` and `abc/def/ghi`, but not `abc` or `abcd` |
| `abc{/,}**` | matches `abc`, `abcd`, `abc/def`, and `abc/def/ghi`          |

All matches above are case-insensitive, even if not shown.

## Negative matching

Renovate has a specific approach to negative matching strings.

"Positive" matches are patterns (in glob or regex) which do _not_ start with `!`.
"Negative" matches are patterns starting with `!`, like `!/^a/` or `!b*`.

For an array of patterns to match, the following must be true:

- If any _positive_ matches are included, at least _one_ must match
- If any _negative_ matches are included, _none_ must match

For example, the pattern `["/^abc/", "!/^abcd/", "!/abce/"]`:

- matches `"abc"` and `"abcf"`
- does _not_ match `"foo"`, `"abcd"`, `"abce"`, or `"abcdef"`

If you find yourself in a situation where you need to positive-match a string which starts with `!`, then you need to do so using a regular expression pattern.
For example, `["/^!abc$/"]` will positively match against the string `"!abc"`.

One limitation of negative matching is when there may be multiple inputs to match against.
For example, a manager may have multiple categories, such as `java` and `docker`.
If you have a rule such as `"matchCategories": ["!docker"]` then this will return `true` because the `java` category satisfies this rule.

## Usage in Renovate configuration options

Renovate has evolved its approach to string pattern matching over time, but this means that existing configurations may have a mix of approaches and not be entirely consistent with each other.

The configuration options that support "regex or glob" syntax mention this in their documentation, and also link to this page.
