# FAQ

If you need a specific behaviour and it's not mentioned here - or it's more
complicated - feel free to raise an
[Issue](https://github.com/renovateapp/renovate/issues) - configuration
questions are welcome in this repository.

### Run renovate on all repositories that the account has access to

Set configuration option `autodiscover` to `true`, via CLI, environment, or
configuration file. Obviously it's too late to set it in any `renovate.json` or
`package.json`.

### Support private npm modules

If you are running your own Renovate instance, then the easiest way to support
private modules is to make sure the appropriate credentials are in `.npmrc` or
`~/.npmrc`;

If you are using a hosted Renovate instance (such as the Renovate app), and your
`package.json` includes private modules, then you can:

1.  Commit an `.npmrc` file to the repository, and Renovate will use this, or
2.  Add the contents of your `.npmrc` file to the config field `npmrc` in your
    `renovate.json` or `package.json` renovate config
3.  Add a valid npm authToken to the config field `npmToken` in your
    `renovate.json` or `package.json` renovate config
4.  If using the [GitHub App hosted service](https://github.com/apps/renovate),
    authorize the npm user named "renovate" with read-only access to the relevant
    modules. This "renovate" account is used solely for the purpose of the
    renovate GitHub App.

### Control renovate's schedule

Renovate itself will run as often as its administrator has configured it (e.g.
hourly, daily, etc). But you may wish to update certain repositories less often,
or even specific packages at a different schedule.

If you want to control the days of the week or times of day that renovate
updates packages, use the `timezone` and `schedule` configuration options.
