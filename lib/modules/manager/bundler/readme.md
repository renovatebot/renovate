Renovate uses the `bundler` manager to extract dependencies from `Gemfile` and `Gemfile.lock` files.

### Authenticating private registry

If:

- you need Bundler to authenticate to a private registry
- _and_ that private registry is _not_ on the same host as Renovate (your GitHub/GitLab/etc)

Then you should authenticate Renovate with `hostRules`.
For example:

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

Important notes:

- `hostType` is optional: a rule with only a `matchHost` is used as well. Set `hostType=rubygems` to keep the credentials from being passed to other package managers
- If you use the same registry for more than one package type, you may need more than one `hostRules` entry
- Instead of `token`, you can use a `username` and `password`

To avoid committing raw secrets to your repository, either:

- If self-hosting: add the `hostRules` to your self-hosted config file, instead of the repository configuration file, or
- If using the Mend Renovate App: use the [`encrypted`](../../../configuration-options.md#encrypted) config option
