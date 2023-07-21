The `bundler` manager is used to extract dependencies from `Gemfile` and `Gemfile.lock` files.

### Authenticating private registry

If you need Bundler to authenticate with a private registry - and it's not the same host as your GitHub/GitLab/etc - then you should do so with `hostRules` and be sure to set the `hostType` value to be "bundler". e.g.

```json
{
  "hostRules": [
    {
      "matchHost": "private-registry.company.com",
      "hostType": "rubygems",
      "token": "abc123"
    }
  ]
}
```

Important notes regarding the above:

`hostType` is a required field, and you must provide a value.
If you use Renovate `v26` or higher, set `hostType=rubygems`.
If you use Renovate `v25` or lower, set `hostType=bundler`.

If the registry is used for multiple package types then you may need multiple `hostRules`.

Instead of `token`, you may also supply `username` and `password` instead.

If you don't want to commit raw secrets to your repository, either:

- If self hosting, add the `hostRules` to your bot's configuration file rather than the repository's configuration file, or
- If using the Mend Renovate App, make use of the [`encrypted`](https://docs.renovatebot.com/configuration-options/#encrypted) capability
