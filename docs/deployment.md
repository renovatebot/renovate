# Deployment

Before deploying the script for scheduled runs, it's recommend you test your settings locally first.

## Server cron

Adding `renovate` as a `cron` job is the simplest way to deploy.

### Installation

Install using `npm install -g`.

### Configuration

At a minimum, you will need to configure the token and repository list.
Simplest would be to specify both via CLI.
Alternatively, configure the token via Environment Variable if you don't want it to show in any cron logs.

Running daily should suit most people. At most, hourly.

## Heroku

Heroku free dynos provide a good way to host this for free. Set it up with the following commands:

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

You should also set any other [Configuration Options](configuration.md) you need.

The app should now be ready for testing.

```
$ heroku run renovate [your/repo]
```

Once you've verified the script ran successfully, it's time to set it up for automatic scheduling.
```
$ heroku addons:create scheduler:standard
$ heroku addons:open scheduler
```

At this point you should have the Heroku Scheduler Dashboard open. Click "Add new job" and enter the same command as you ran previously (e.g. `renovate [your/repo]`). Adjust the frequency to hourly if you prefer, then click Save.

You can run `heroku logs` to check execution logs. Consider adjusting the scripts log level if you have problems (info -> verbose -> debug -> silly).

## Docker

Renovate can also be run as a Docker container.

### Using docker-compose

One way to run `renovate` with Docker is using a docker-compose file like the following:

```
version: '2'
services:
  renovate:
    image: <DOCKER_HUB_IMAGE>
    environment:
      GITHUB_TOKEN: <MY_GITHUB_TOKEN>
      # GITLAB_TOKEN: <MY_GITLAB_TOKEN>
    command: [<PARAMS>] <MY_REPOS>
    # command: singapore/lint-condo singapore/package-test
    # command: --labels=renovate,dependency singapore/lint-condo
```

The `command` directive above may contain only a simple list of repos or additionally any of the available `renovate CLI parameters`.

To run the compose file above, simply use `docker-compose up`. The container will run and exit once it has finished processing your repositories. To run it on a schedule, add a cronjob that executes it for you (e.g. daily or hourly).

### Using docker

To run `renovate` without depending on docker-compose like above, you may also just use native Docker commands:

```
$ docker run --rm -e "GITHUB_TOKEN=<MY_GITHUB_TOKEN>" <DOCKER_HUB_IMAGE> --labels=renovate,dependency singapore/lint-condo
```

The configuration options are the same as for running it with docker-compose. To run it on a schedule, add a cronjob that executes the above command for you (e.g. daily or hourly).
