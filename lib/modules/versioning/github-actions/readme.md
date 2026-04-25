Versioning specific to GitHub Actions' usage of Semantic Versioning, for mutable and immutable tags.

The "shortest" tag will be used where possible - if you are previously using `v7`, and there is an upgrade to `v7.5.3`, `v7` will be used.

### Immutable Tags

When using [Immutable Releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases) for GitHub Tags, it is required to use explicit SemVer `major.minor.patch` versions.

If you have previously used an unpinned version, such as `@v7`, Renovate will migrate you on the next update, such as:

```diff
-       uses: astral-sh/setup-uv@v7
+       uses: astral-sh/setup-uv@v8.1.0
```
