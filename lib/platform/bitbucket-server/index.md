# Bitbucket Server Support

## Unsupported platform features/concepts

- Adding assignees to PRs not supported (does not seem to be a Bitbucket concept)
- Adding/removing labels (Bitbucket limitation?)

## Features awaiting implementation

- Creating issues not implemented yet, used to alert users when there is a config error

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

Alternatively using env:

```
export RENOVATE_PLATFORM=bitbucket-server
export RENOVATE_ENDPOINT=http://localhost:7990
export RENOVATE_GIT_FS=http
export RENOVATE_USERNAME=renovate-bot
export RENOVATE_PASSWORD=abc123456789!
export LOG_LEVEL=debug
yarn start --autodiscover=true
```

You should then receive a "Configure Renovate" onboarding PR in any projects that `@renovate-bot` has been invited to.

## Supported versions

We support all Bitbucket Server versions which are not EOL.
See [Atlassian Support End of Life Policy](https://confluence.atlassian.com/support/atlassian-support-end-of-life-policy-201851003.html#AtlassianSupportEndofLifePolicy-BitbucketServer) for uptodate versions.
