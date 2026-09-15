# Forgejo

Renovate supports [Forgejo](https://forgejo.org).

## Authentication

First, [create a Personal Access Token (PAT)](https://forgejo.org/docs/latest/user/api-usage/#authentication) for the Renovate account.
The Renovate account should have full name and email address configured.
Then let Renovate use your PAT by doing _one_ of the following:

- Set your PAT as a `token` in your `config.js` file
- Set your PAT as an environment variable `RENOVATE_TOKEN`
- Set your PAT when you run Renovate in the CLI with `--token=`

You must set `platform=forgejo` in your Renovate config file.

The PAT should have these permissions:

| Scope          | Permission       | Valid for Forgejo versions     | Notes                                 |
| -------------- | ---------------- | ------------------------------ | ------------------------------------- |
| `repo`         | `Read and Write` | all                            |                                       |
| `user`         | `Read`           | all                            |                                       |
| `issue`        | `Read and Write` | `>= 1.20.0`                    |                                       |
| `organization` | `Read`           | `>= 1.20.0`                    | Required to read org labels and teams |
| `email`        | `Read`           | `<= 1.19.3`                    |                                       |
| `misc`         | `Read`           | Only for `1.20.0` and `1.20.1` |                                       |

If you use Forgejo packages, add the `read:packages` scope.

### Authorized Integrations (OIDC)

Instead of a static PAT, Renovate can authenticate with a short-lived OIDC ID token as a [Forgejo Authorized Integration](https://forgejo.org/docs/latest/user/authorized-integrations/).
This needs Renovate to run in a Forgejo Actions workflow, so that the Actions runtime can issue the ID token.

To use an Authorized Integration:

1. Create an Authorized Integration of type "Forgejo Actions (Local)" for the Renovate account, and note the generated audience value
1. Set `enable-openid-connect: true` in the Forgejo Actions workflow that runs Renovate
1. Set the [`forgejoOidcAudience`](../../../self-hosted-configuration.md#forgejooidcaudience) config option (or the `RENOVATE_FORGEJO_OIDC_AUDIENCE` environment variable) to the generated audience value
1. Do _not_ configure a `token`

Renovate then requests an ID token from the Actions runtime at startup and uses it as the platform token.

Alternatively, you can retrieve a JWT yourself (for example for a "Generic JWT" Authorized Integration) and pass it to Renovate as the `token`, because Renovate authenticates against the Forgejo API with an `Authorization: Bearer` header.
Keep in mind that these tokens are short-lived: the token must stay valid for the whole Renovate run.

## Unsupported platform features/concepts

- **`platformAutomerge` (`true` by default) for platform-native automerge not supported**: Forgejo versions older than v10.0.0 don't support required branch autodelete for automerge.

## Features awaiting implementation

- none

## Repo autodiscover

Renovate can discover repositories on Forgejo using the `autodiscover` feature.
Repositories are ignored when one of the following conditions is met:

- The repository is a `mirror`
- We do not have push or pull permissions to that repository
- Pull requests are disabled for that repository

You can change the default server-side sort method and order for autodiscover API.
Set those via [`autodiscoverRepoSort`](../../../self-hosted-configuration.md#autodiscoverreposort) and [`autodiscoverRepoOrder`](../../../self-hosted-configuration.md#autodiscoverrepoorder).
Read the [Forgejo swagger docs](https://code.forgejo.org/api/swagger#/repository/repoSearch) for more details.

## Merge style

Renovate uses the repository's default merge style if allowed; if the default
merge style is not an allowed merge style, renovate falls back to an allowed
merge style as per an order chosen to minimize commits. If no merge style is
allowed, the repository is blocked.
