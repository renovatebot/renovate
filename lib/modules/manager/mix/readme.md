The `mix` manager uses Renovate's implementation of [Elixir SemVer](https://hexdocs.pm/elixir/Version.html#module-requirements) to evaluate update ranges.

The `mix` package manager itself is used to keep the lock file up-to-date.

The following `depTypes` are currently supported by the `mix` manager :

- `prod`: all dependencies by default
- `dev`: dependencies with [`:only` option](https://hexdocs.pm/mix/Mix.Tasks.Deps.html#module-dependency-definition-options) not containing `:prod`

### Private Hex repositories

Declare custom Hex repositories in `mix.hexRepositories`. Each key must match the literal `repo:` name in `mix.exs`. Set the repository base URL and exactly one of `publicKeyFingerprint` or `publicKey`.

If the registry publishes its key at `/public_key`, use the `SHA256:` fingerprint supplied by the registry operator. For example, for a dependency declared with `repo: "oban"`:

```json
{
  "mix": {
    "hexRepositories": {
      "oban": {
        "url": "https://repo.oban.pro",
        "publicKeyFingerprint": "SHA256:4/OSKi0NRF91QVVXlGAhb/BIMLnK8NHcx/EWs+aIWPc"
      }
    }
  }
}
```

Store credentials separately in a [`hostRules`](../../../configuration-options.md#hostrules) entry with `hostType: "hex"`, `matchHost` set to the repository base URL, and `token` set to the registry token. Set `authType: "Token-Only"` for a bare token or `authType: "Bearer"` for a Bearer token. Omit the credentials if the registry does not require authentication.

For registries such as [Artifactory](https://docs.jfrog.com/artifactory/docs/hex-repositories) that provide the key separately, paste the contents of the RSA public key PEM into `publicKey`, using `\n` for line breaks. Renovate uses that key directly, without requesting `/public_key`. This example uses Bearer authentication for `repo: "hex-local"`. Replace the example PEM with your repository's public key.

```json
{
  "mix": {
    "hexRepositories": {
      "hex-local": {
        "url": "https://company.jfrog.io/artifactory/api/hex/hex-local",
        "publicKey": "-----BEGIN RSA PUBLIC KEY-----\nMIIBCgKCAQEA1GFdKUtRr59cbL3hThDij8KegKUNnmhRY6Kn8iMvL2lNVTCYQKB/\nk7KcLmDW5kUHpjrEqT3m/l5Kfuz/1EHz4psszS9W1cM9bP+u6r6XY2yvoIOKJ7k1\nEWoX5g6uiaU43TF3Cpned7mgCTAzHAkeS+TFAdnxV0A8yR7QTOD55F+dih2iIjai\n7SNBPWOC3YjgkuYR/EiHuhBmjxpRQ/Xb5aBCSmZZ7YJ1AVLh+DdOWShcqKaUPsPS\nCF6dA3g+uQWu/xgc5T5cH/1w6wFQDpQqX73njtfcSfOJcYBHZUaH8z62ZltHcteO\n/MIs+9COM7IgGoQ3slR/oviEIOzvSwIT4wIDAQAB\n-----END RSA PUBLIC KEY-----"
      }
    }
  },
  "hostRules": [
    {
      "hostType": "hex",
      "matchHost": "https://company.jfrog.io/artifactory/api/hex/hex-local",
      "authType": "Bearer",
      "token": "{{ secrets.HEX_TOKEN }}"
    }
  ]
}
```

Renovate checks repository signatures in both cases. Declare all repositories needed by Mix, including those used only by transitive dependencies or other apps in an umbrella project.

Before starting Mix, Renovate checks the declared repository URLs, their DNS results, and `enabled: false` host rules scoped beneath the repository URL. Mix performs its own HTTP requests after launch, including DNS resolution and redirects. Use a registry URL that serves packages and tarballs without redirects, and use network egress controls if the Mix process must be restricted to particular destinations. Some Hex versions forward the repository's authorization header on redirects.

With `binarySource=docker`, `dockerUser` must be Renovate's numeric UID or `0` so Mix can access the private `HEX_HOME`.

### `lockFileMaintenance`

We recommend you use [`lockFileMaintenance`](../../../configuration-options.md#lockfilemaintenance) for the `mix` manager.

`lockFileMaintenance=true` periodically refreshes your `mix.lock` files, ensuring all indirect dependencies are updated to their latest allowed versions.

This option will be skipped in [umbrella projects](https://hexdocs.pm/elixir/dependencies-and-umbrella-projects.html#umbrella-projects), as they share a single
`mix.lock` file for all applications `mix.exs` files.

### Default `rangeStrategy=auto` behavior

Renovate's default [`rangeStrategy`](../../../configuration-options.md#rangestrategy) is `"auto"`.
Here is how `"auto"` works with the `mix` manager:

| Version type             | New version | Old range             | New range after update | What Renovate does                                                        |
| :----------------------- | :---------- | :-------------------- | :--------------------- | :------------------------------------------------------------------------ |
| Complex range            | `1.7.2`     | `< 1.7.0 or ~> 1.7.1` | `< 1.7.0 or ~> 1.7.2`  | Widen range to include the new version.                                   |
| Simple range             | `0.39.0`    | `<= 0.38.0`           | `<= 0.39.0`            | If update outside current range: widens range to include the new version. |
| Exact version constraint | `0.13.0`    | `== 0.12.0`           | `== 0.13.0`            | Replace old version with new version.                                     |

### Recommended `rangeStrategy` for apps and libraries

For applications, we recommend using `rangeStrategy=pin`.
This pins your dependencies to exact versions, which is generally considered [best practice for apps](../../../dependency-pinning.md).

For libraries, use `rangeStrategy=widen` with version ranges in your `mix.exs`.
This allows for greater compatibility with other projects that may use your library as a dependency.
