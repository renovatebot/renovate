# Calling AWS Services from Renovate

When one of Renovate's inbuilt datasources interacts with AWS services, Renovate uses the AWS SDK for JavaScript.
This allows you to provide credentials and configuration to it, as if you were interacting with other tools, like the `aws` CLI.

For example:

- Set the region via the `AWS_REGION` environment variable or your `~/.aws/config` file
- Provide credentials via the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment variables or your `~/.aws/credentials` file
- Select the profile to use via `AWS_PROFILE` environment variable

!!! tip
  Read the [AWS Developer Guide - Configuring the SDK for JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/configuring-the-jssdk.html) for more information on these configuration options.
