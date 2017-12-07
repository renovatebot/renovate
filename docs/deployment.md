# Deployment

Before deploying the script for scheduled runs, it's recommend you test your
settings locally first.

## Server cron

Adding `renovate` as a `cron` job is the simplest way to deploy.

### Installation

Install using `npm install -g`.

### Configuration

At a minimum, you will need to configure the token and repository list. Simplest
would be to specify both via CLI. Alternatively, configure the token via
Environment Variable if you don't want it to show in any cron logs.

Running daily should suit most people. At most, hourly.

## Heroku

Heroku free dynos provide a good way to host this for free. Set it up with the
following commands:

### Installation

The best way to deploy to Heroku is via git and Heroku CLI.

```
$ git clone https://github.com/renovateapp/renovate
$ cd renovate
$ heroku create [app name]
$ git push heroku master
```

### Configuration

You now need to set the token.

```
$ heroku config:set GITHUB_TOKEN=[YourGitHubToken]
```

(or use `GITLAB_TOKEN` if appropriate)

You should also set any other [Configuration Options](configuration.md) you
need.

The app should now be ready for testing.

```
$ heroku run renovate [your/repo]
```

Once you've verified the script ran successfully, it's time to set it up for
automatic scheduling.

```
$ heroku addons:create scheduler:standard
$ heroku addons:open scheduler
```

At this point you should have the Heroku Scheduler Dashboard open. Click "Add
new job" and enter the same command as you ran previously (e.g. `renovate [your/repo]`). Adjust the frequency to hourly if you prefer, then click Save.

You can run `heroku logs` to check execution logs. Consider adjusting the
scripts log level if you have problems (info -> verbose -> debug -> silly).
