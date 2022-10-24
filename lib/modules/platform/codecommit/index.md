# AWS CodeCommit

<!-- prettier-ignore -->
!!! warning "This feature is flagged as experimental"
    Experimental features might be changed or even removed at any time, To track this feature visit the following GitHub issue [#2868](https://github.com/renovatebot/renovate/issues/2868)

## Authentication

First, you need to obtain an AWS [IAM Access Key id and a Secret access key id](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html)

Let Renovate use AWS CodeCommit access keys by doing one of the following:

1. Set a Renovate configuration file - config.js and set:

   ```
   username: AWS IAM access key id
   password: AWS Secret access key
   endpoint: the url endpoint e.g https://git-codecommit.us-east-1.amazonaws.com/
   token: AWS session token, if you have one
   ```

2. Set up the environment with all required AWS environment variables for authentication, e.g:

   ```
   AWS_ACCESS_KEY_ID: AWS IAM access key id
   AWS_SECRET_ACCESS_KEY: AWS Secret access key
   AWS_REGION: the AWS region e.g us-east-1
   AWS_SESSION_TOKEN: AWS session token, if you have one
   ```

## AWS IAM security policies

- Make sure to attach the [AWSCodeCommitFullAccess](https://docs.aws.amazon.com/codecommit/latest/userguide/security-iam-awsmanpol.html#managed-policies-full) policy to your IAM User.
- It is recommended to also attach the [IAMReadOnlyAccess](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-iam-awsmanpol.html) policy to your IAM User

## Running Renovate

Set up a global configuration file (config.js) for running Renovate on CodeCommit:

- Set `platform: 'codecommit'`
- Set `repositories: ['{repository names separated by comma}']`, or alternatively use Renovate’s [autodiscover](https://docs.renovatebot.com/self-hosted-configuration/#autodiscover)

Run Renovate with the configuration file, and it will create an onboarding Pull Request in your set repositories.

## Unsupported platform features/concepts

- adding assignees to PRs not supported
- auto-merge not supported
- rebaseLabel isn't supported (request a rebase for Renovate)

## recommendations

- We recommend limiting Open Renovate PRs using `prConcurrentLimit`
- Due to current platform limitations, if you close a PR and don’t wish for Renovate to recreate if, use [package rules](https://docs.renovatebot.com/configuration-options/#packagerules) with the `"enabled": false` key.

Here's an example config.js:

```js
module.exports = {
  endpoint: 'https://git-codecommit.us-east-1.amazonaws.com/',
  platform: 'codecommit',
  repositories: ['abc/def', 'abc/ghi'],
  username: 'ACCESS_KEY_ID_GOES_HERE',
  password: 'SECRET_ACCESS_KEY_GOES_HERE',
  gitAuthor: 'your_email@domain',
  prConcurrentLimit: 10,
};
```
