**_Hermit package installation token_**

When upgrading private packages through, Hermit manager will uses one of the following two tokens to download private packages.

```
HERMIT_GITHUB_TOKEN
GITHUB_TOKEN
```

These environment variable could be passed on via setting it in `customEnvironmentVariables`.

Git credentials configured in `hostRules` are also automatically propagated to `hermit install` via `GIT_CONFIG_*` environment variables.
This enables Hermit to fetch packages from private Git repositories without additional configuration.

**_Nested Hermit setup_**

Nested Hermit setup in a single repository is also supported. e.g.

```
├bin
├─hermit
├─(other files)
├
├nested
├─bin
├──hermit
├──(other files)
```
