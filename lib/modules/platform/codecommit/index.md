# AWS CodeCommit

## Authentication

First, you need to obtain an AWS [IAM Access Key id and a Secret access key id](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html)

Let Renovate use AWS CodeCommit access keys by doing one of the following:

- Set a Renovate configuration file - config.js and set:
  - `endpoint:` the url endpoint e.g `https://git-codecommit.us-east-1.amazonaws.com/`
  - `username:` AWS IAM access key id
  - `password:` AWS Secret access key
- Set environment variables:
  - `AWS_REGION:` the region e.g `us-east-1`
  - `AWS_ACCESS_KEY_ID:` your IAM Access key id
  - `AWS_SECRET_ACCESS_KEY:` your IAM Secret access key id

Make sure to attach the [AWSCodeCommitFullAccess policy](https://docs.aws.amazon.com/codecommit/latest/userguide/security-iam-awsmanpol.html#managed-policies-full) to your IAM identities.

## Running Renovate

Set up a global configuration file (config.js) for running Renovate on CodeCommit:

- Set `platform: 'codecommit'`
- Set `repositories: ['{repository names separated by comma}']`, or alternatively use Renovate’s [autodiscover](https://docs.renovatebot.com/self-hosted-configuration/#autodiscover)

Run Renovate with the configuration file and it will create an onboarding Pull Request in your set repositories.


## Unsupported platform features/concepts

- adding assignees to PRs not supported
- auto-merge not supported
- rebaseLabel isn't supported (request a rebase for Renovate)

## recommendations

- We recommend limiting Open Renovate PRs using `prConcurrentLimit`
- Due to current platform limitations, if you close a PR and don’t wish for Renovate to recreate if, use [package rules](https://docs.renovatebot.com/configuration-options/#packagerules) with the `"enabled": false` key.


Here's an example config.js:
```module.exports = {
  endpoint: 'https://git-codecommit.{your region}.amazonaws.com/',
  platform: 'codecommit',
  repositories: ['{your repository names separated by comma}'],
  username: '{your access key id}',
  password: '{your secret access key}',
  gitAuthor: '{Self-hosted Renovate Bot <your_email@domain>}',
  prConcurrentLimit: 10,
};
```

