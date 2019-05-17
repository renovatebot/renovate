# CircleCI

https://circleci.com/docs/2.0/about-circleci/#section=welcome

## Setting up CircleCI

Start with adding a `config.yml` file inside `.circleci` folder under the root of your project. This `config.yml` file will contain our CI/CD processes. Create an account on CircleCI and connect it with your github account. Trigger a build on one of your repo and CircleCI will lookup for a `.circleci/config.yml` file in your repo and start setting up your defined CI/CD processes.

You can find some sample `config.yml` files here : https://circleci.com/docs/2.0/sample-config/

NOTE : You need to add the config file before triggering a build or else the build will fail.

## Migrating from TravisCI to CircleCI

Migrating from Travis to CircleCI is pretty straight forward, CircleCI has great documentation which lists the comparison between the commands used in Travis and it's relevant command in CircleCI.

https://circleci.com/docs/2.0/migrating-from-travis/

## Triggering a build only for master

Triggering a build only when something is pushed to `master` branch can be done using `filters`.

```yaml
    filters:
        branches:
            only: - master
```

https://circleci.com/docs/2.0/configuration-reference/#filters-1

## Using Jobs in CircleCI

We can segregate steps of our CI/CD processes into jobs. For example, if you are handling a large microservices based application, then you would want to define the commands for each microservice as a separate job. Jobs can be run parallely or sequentially using workflows.

https://circleci.com/docs/2.0/configuration-reference/#jobs

## Using Workflows in CircleCI

Workflows makes troubleshooting jobs much easier. We can define the order of execution of jobs using workflows.

https://circleci.com/docs/2.0/workflows/

## Triggering a build for Pull Requests

Consfiguring CircleCI to trigger a build whenever a PR is created can be handled through the web interface of CircleCI.

https://circleci.com/docs/2.0/oss/#only-build-pull-requests

## Notification Settings of CircleCI

Don't like much noise? Don't worry, you can setup notification settings of CircleCI right through the web interface so that you only get notified for what you think is important.

https://circleci.com/docs/2.0/notifications/
