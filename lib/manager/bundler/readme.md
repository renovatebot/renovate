The `bundler` manager is used to extract dependencies from `Gemfile` and `Gemfile.lock` files.

### Authenticating private registry

If you need Bundler to authenticate with a private registry - and it's not the same host as your GitHub/GitLab/etc - then you should do so with `hostRules` and be sure to set the `hostType` value to be "bundler". e.g.

```json
{
  "hostRules": [
    {
      "matchHost": "private-registry.company.com",
      "hostType": "bundler",
      "token": "abc123"
    }
  ]
}
```

Important notes regarding the above:

`hostType=bundler` is essential. If the registry is used for multiple package types then you may need multiple `hostRules`. You cannot leave off `hostType`.

Instead of `token`, you may also supply `username` and `password` instead.

If you don't want to commit raw secrets to your repository, either:

- If self hosting, add the `hostRules` to your bot's configuration file rather than the repository's configuration file, or
- If using the hosted WhiteSource Renovate app, make use of the [`encrypted`](https://docs.renovatebot.com/configuration-options/#encrypted) capability
