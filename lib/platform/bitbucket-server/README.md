# Bitbucket Server Support

Bitbucket Server support is considered in "alpha" release status.

## Unsupported platform features/concepts

- Adding assignees to PRs not supported (does not seem to be a Bitbucket concept)
- Adding/removing labels (Bitbucket limitation?)

## Features requiring implementation

- Creating issues not implemented yet, e.g. when there is a config error
- Adding reviewers to PRs not implemented yet
- Adding comments to PRs not implemented yet, e.g. when a PR has been edited or has a lockfile error

## Testing

If you want a test Bitbucket server locally rather than with your production server, [Atlassian's Bitbucket Server Docker image](https://hub.docker.com/r/atlassian/bitbucket-server) is really convenient.

As per their instructions, the following commands bring up a new server:

```
docker volume create --name bitbucketVolume
docker run -v bitbucketVolume:/var/atlassian/application-data/bitbucket --name="bitbucket" -d -p 7990:7990 -p 7999:7999 atlassian/bitbucket-server:5.12.3
```

Once it's running and initialized, the quickest way to testing with Renovate is:

1. Create the admin user as prompted
2. Create a new project and a repository for that project
3. Make sure the repository has a package file in it for Renovate to find, e.g. `.nvmrc` or `package.json`
4. Create a dedicated REnovate user `@renovate-bot` and grant it write access to the project
5. Note down the password for `@renovate-bot` and use it in the Renovate CLI

At this point you should have a project ready for Renovate, and the `@renovate-bot` account ready to run on it. You can then run like this:

```
yarn start --platform=bitbucket-server --endpoint=http://localhost:7990 --git-fs=http --username=renovate-bot --password=abc123456789! --log-level=debug --autodiscover=true
```

Remember that the above CLI parameters can also be exported to env if you prefer, e.g. `export RENOVATE_PLATFORM=bitbucket-server`, etc.

You should then receive a "Configure Renovate" onboarding PR in the project.
