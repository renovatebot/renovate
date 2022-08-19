# Static Data

Some data used by Renovate is stored in the repository and bundled with Renovate.
This is either because the data changes infrequently or would be infeasible to parse on every run.

## Updating static data

Static data is updated weekly with a [GitHub Actions workflow](https://github.com/renovatebot/renovate/actions/workflows/update-data.yml).
You can also update it manually by running `yarn run update-static-data`.
