# AWS CodeCommit

<!-- prettier-ignore -->
!!! warning "This feature is flagged as experimental"
    Experimental features might be changed or even removed at any time.
    Subscribe to [GitHub issue #2868](https://github.com/renovatebot/renovate/issues/2868) to be notified of any changes.

## Authentication

### IAM Role

#### Machine pre-requisites

1. `aws-cli` installed.
2. Set up the environment with `git-credentials-helper`.
   EC2/linux: [EC2 codecommit git integration](https://aws.amazon.com/premiumsupport/knowledge-center/codecommit-git-repositories-ec2/).

   windows: [windows codecommit git integration](https://docs.aws.amazon.com/codecommit/latest/userguide/setting-up-https-windows.html).

3. Set the environment variable `AWS_REGION`.

#### Codebuild Configuration

add `git-credential-helper` to your `buildspec.yml`.

```yaml
env: git-credential-helper:yes
```

### IAM User

First, you must get an AWS [IAM Access Key id and a Secret access key id](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html)

Let Renovate use AWS CodeCommit authentication keys by doing one of the following:

- Set a Renovate configuration file - `config.js`:

  ```
  username: AWS IAM access key id
  password: AWS Secret access key
  endpoint: the URL endpoint e.g https://git-codecommit.us-east-1.amazonaws.com/
  token: AWS session token, if you have one
  ```

- Set up the environment with all required AWS environment variables:

  ```
  AWS_ACCESS_KEY_ID: AWS IAM access key id
  AWS_SECRET_ACCESS_KEY: AWS Secret access key
  AWS_REGION: the AWS region e.g us-east-1
  AWS_SESSION_TOKEN: AWS session token, if you have one
  ```

- Set up AWS credentials using CLI parameters:

  ```
  --username: AWS IAM access key id
  --password: AWS Secret access key
  --endpoint: the URL endpoint for example https://git-codecommit.us-east-1.amazonaws.com/
  --token: AWS session token, if you have one
  ```

## Permissions

Create a new AWS policy for renovate with these permissions, then attach it to the user/role.

Change the `Resource` value to the resources you want to use.

The policy json.

```json
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
        "codecommit:DescribePullRequestEvents",
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

Set up a global configuration file (`config.js`), or use CLI parameters or environment variables, to run Renovate on CodeCommit:

- Set `platform: 'codecommit'`
- Set `repositories: ['{repository, names, separated, by, comma}']`, or use [Renovate’s `autodiscover` feature](https://docs.renovatebot.com/self-hosted-configuration/#autodiscover)

Run Renovate and it will process your repositories.

## Unsupported platform features/concepts

These features are not supported:

- Adding assignees to PRs
- Auto-merge
- [`rebaseLabel`](https://docs.renovatebot.com/configuration-options/#rebaselabel) (request a rebase for Renovate)

## Recommendations

- We recommend that you limit the number of open Renovate PRs by setting a `prConcurrentLimit`
- Due to current platform limitations, if you close a PR but don’t want for Renovate to recreate the PR, use [package rules](https://docs.renovatebot.com/configuration-options/#packagerules) with the `"enabled": false` key

## Example configuration

Here's an example `config.js`:

```js
module.exports = {
  endpoint: 'https://git-codecommit.us-east-1.amazonaws.com/',
  platform: 'codecommit',
  repositories: ['abc/def', 'abc/ghi'],
  username: 'ACCESS_KEY_ID_GOES_HERE',
  password: 'SECRET_ACCESS_KEY_GOES_HERE',
  token: 'AWS_SESSION_TOKEN_GOES_HERE',
  gitAuthor: 'your_email@domain',
  prConcurrentLimit: 10,
  packageRules: [
    {
      matchPackageNames: ['package_name', 'package_name2'],
      enabled: false,
    },
  ],
};
```
