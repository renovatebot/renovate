Keeps publicly accessible Git submodules updated within a repository.

Renovate does not support updating Git submodules that are hosted on a private repository.
Subscribe to [issue #10149 on GitHub](https://github.com/renovatebot/renovate/issues/10149) to keep track of our progress towards supporting private Git submodules.

You can customize the per-submodule checks of the git-submodules manager like this:

```json
{
  "ignoreDeps": ["path/to/submodule", "path/to/submodule2"],
  "git-submodules": {
    "enabled": true
  }
}
```
