# AWS CodeCommit

## Authentication

We are using AWS CodeCommit SDK,
if you do not have IAM access key id and Secret access key id
first read SDK about how to get the [IAM Access Keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html)

Requirements for authentication:

can be set in renovate config file:

`endpoint`: the url endpoint e.g `https://git-codecommit.us-east-1.amazonaws.com/`

`username`: the AWS IAM access key id

`password`: the AWS IAM secret access key

or as environment variables:

`AWS_REGION` : the region e.g `us-east-1`

`AWS_ACCESS_KEY_ID` : your IAM Access key id

`AWS_SECRET_ACCESS_KEY` : your IAM Secret access key id

| Permission                                                                                                                                               | Scope                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| AWS managed policy: [AWSCodeCommitFullAccess](https://docs.aws.amazon.com/codecommit/latest/userguide/security-iam-awsmanpol.html#managed-policies-full) | CodeCommit: Full Access |

- Set `platform=codecommit` somewhere in your Renovate config file

## Unsupported platform features/concepts

- adding assignees concept doesn't exist in CodeCommit
- auto-merge doesn't work currently, there is no way to check CodeBuild status efficiently
- rebaseLabel isn't supported
- close PR to ignore is not supported, there is no way to get all pull requests efficiently

## recommendations

- it's always best to keep OPEN prs by renovate user to a maximum of 10, because every PR costs an extra AWS request
