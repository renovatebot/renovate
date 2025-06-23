# AWS CodeCommit

<!-- prettier-ignore -->
!!! warning "No new features for the Codecommit platform"
    Amazon has deprecated the Codecommit platform.
    We will not work on new features for the Codecommit platform.
    Read the [AWS blog, how to migrate your AWS Codecommit repository](https://aws.amazon.com/blogs/devops/how-to-migrate-your-aws-codecommit-repository-to-another-git-provider/) to learn more.

<!-- prettier-ignore -->
!!! warning "This feature is flagged as experimental"
    Experimental features might be changed or even removed at any time.

## Authentication

### IAM Role

#### Machine pre-requisites

<!--
  TODO: remove ignore
  prettier & markdownlint conflicting nested list format
  see: https://github.com/renovatebot/renovate/pull/30608
-->
<!-- prettier-ignore -->
1. Install the `aws-cli` program on the machine.
2. Set up the environment with the `git-credentials-helper`:
    - For EC2 or Linux: [EC2 codecommit git integration](https://aws.amazon.com/premiumsupport/knowledge-center/codecommit-git-repositories-ec2/).
    - For Windows: [windows codecommit git integration](https://docs.aws.amazon.com/codecommit/latest/userguide/setting-up-https-windows.html).

3. Set the environment variable `AWS_REGION`.

#### Codebuild Configuration

```yaml title="Add git-credential helper to your buildspec.yml file"
env: git-credential-helper:yes
```

### IAM User

First, you must get an AWS [IAM Access Key id and a Secret access key id](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html).
After that, let Renovate use the AWS CodeCommit authentication keys, by picking _one_ of these methods:

- Create a Renovate config file (`config.js`)
- Set the environment with all required AWS environment variables
- Set AWS credentials with CLI parameters

#### Method 1: Create a Renovate config file (`config.js`)

```
username: AWS IAM access key id
password: AWS Secret access key
endpoint: the URL endpoint e.g https://git-codecommit.us-east-1.amazonaws.com/
token: AWS session token, if you have one
```

#### Method 2: Set the environment with all required AWS environment variables

```
AWS_ACCESS_KEY_ID: AWS IAM access key id
AWS_SECRET_ACCESS_KEY: AWS Secret access key
AWS_REGION: the AWS region e.g us-east-1
AWS_SESSION_TOKEN: AWS session token, if you have one
```

#### Method 3: Set AWS credentials with CLI parameters

```
--username: AWS IAM access key id
--password: AWS Secret access key
--endpoint: the URL endpoint for example https://git-codecommit.us-east-1.amazonaws.com/
--token: AWS session token, if you have one
```

## Permissions

Create a new AWS policy for Renovate with these permissions, then attach it to the user/role.

Change the `Resource` value to the resources you want to use:

```json title="Example policy JSON file"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "RenovatePolicy",
      "Effect": "Allow",
      "Action": [
        "codecommit:DeleteCommentContent",
        "codecommit:UpdatePullRequestDescription",
        "codecommit:GitPull",
        "codecommit:ListPullRequests",
        "codecommit:GetCommentsForPullRequest",
        "codecommit:ListRepositories",
        "codecommit:UpdatePullRequestTitle",
        "codecommit:GetFile",
        "codecommit:UpdateComment",
        "codecommit:GetRepository",
        "codecommit:CreatePullRequest",
        "codecommit:CreatePullRequestApprovalRule",
        "codecommit:GitPush",
        "codecommit:UpdatePullRequestStatus",
        "codecommit:GetPullRequest"
      ],
      "Resource": "*"
    }
  ]
}
```

## Running Renovate

Once you have followed method 1, 2 or 3, _and_ have set up the permissions, you're ready to configure Renovate:

- Set `platform: 'codecommit'`
- Set `repositories: ['{repository, names, separated, by, comma}']`, or use [Renovate’s `autodiscover` feature](../../../self-hosted-configuration.md#autodiscover)

You're ready to run Renovate now, and it will process your repositories.

## Unsupported platform features/concepts

These Renovate features are not supported on Codecommit:

- Adding assignees to PRs
- Automerge
- [`rebaseLabel`](../../../configuration-options.md#rebaselabel) (request a rebase for Renovate)

## Recommendations

Limit the number of open Renovate PRs by setting a `prConcurrentLimit`.

If you close a PR but don’t want Renovate to recreate the PR later, then use [package rules](../../../configuration-options.md#packagerules) with the `"enabled": false` key.
This workaround is needed due to platform limitations.

## Example configuration

```js title="Example config.js file"
module.exports = {
  endpoint: 'https://git-codecommit.us-east-1.amazonaws.com/',
  platform: 'codecommit',
  repositories: ['abc/def', 'abc/ghi'],
  username: 'ACCESS_KEY_ID_GOES_HERE',
  password: 'SECRET_ACCESS_KEY_GOES_HERE',
  token: 'AWS_SESSION_TOKEN_GOES_HERE',
  gitAuthor: 'your_email@domain',
  packageRules: [
    {
      matchPackageNames: ['package_name', 'package_name2'],
      enabled: false,
    },
  ],
};
```

## CodeBuild examples

Create a repository with a `buildspec.yml` file in it.
This repository will be your BuildProject job repository to run Renovate on your repositories.

### Renovate Docker `buildspec.yml`

```yml title="Example buildspec.yml file"
version: 0.2
env:
  shell: bash
  git-credential-helper: yes
  variables:
    RENOVATE_PLATFORM: 'codecommit'
    RENOVATE_REPOSITORIES: '["repoName1", "repoName2"]'
    RENOVATE_CONFIG: '{"extends":["config:recommended"]}'
    LOG_LEVEL: 'debug'
    AWS_REGION: 'us-east-1'
phases:
  build:
    on-failure: CONTINUE
    commands:
      - docker run --rm -e AWS_REGION -e RENOVATE_CONFIG -e RENOVATE_PLATFORM -e RENOVATE_REPOSITORIES -e LOG_LEVEL renovate/renovate
```

### Renovate CLI `buildspec.yml`

```yml title="Example buildspec.yml file"
version: 0.2
env:
  shell: bash
  git-credential-helper: yes
  variables:
    RENOVATE_PLATFORM: 'codecommit'
    RENOVATE_REPOSITORIES: '["repoName1", "repoName2"]'
    RENOVATE_CONFIG: '{"extends":["config:recommended"]}'
    LOG_LEVEL: 'debug'
    AWS_REGION: 'us-east-1'
phases:
  build:
    on-failure: CONTINUE
    commands:
      - npm install -g renovate
      - renovate
```

### Notes

To keep BuildProject processing times reasonable, we recommend that you install Renovate on the BuildProject Renovate job repository.
This also avoids running the `npm install` command.

You can add the `config.js` global config to the repository.

You can add the BuildProject repository to the `RENOVATE_REPOSITORIES` variable and get updates on new Renovate versions.
