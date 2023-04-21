This datasource returns the database engine versions available for use on [AWS RDS](https://aws.amazon.com/rds/) via the AWS API.
Generally speaking, all publicly released database versions are available for use on RDS.
However, new versions may not be available on RDS for a few weeks or months after their release while AWS tests them.
In addition, AWS may pull existing versions if serious problems arise during their use.

**AWS API configuration**

Since the datasource uses the AWS SDK for JavaScript, you can configure it like other AWS Tools.
You can use common AWS configuration options, for example:

- Set the region via the `AWS_REGION` environment variable or your `~/.aws/config` file
- Provide credentials via the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment variables or your `~/.aws/credentials` file
- Select the profile to use via `AWS_PROFILE` environment variable

Read the [AWS Developer Guide - Configuring the SDK for JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/configuring-the-jssdk.html) for more information on these configuration options.

The minimal IAM privileges required for this datasource are:

```json
{
  "Sid": "AllowDBEngineVersionLookup",
  "Effect": "Allow",
  "Action": ["rds:DescribeDBEngineVersions"],
  "Resource": "*"
}
```

Read the [AWS RDS IAM reference](https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazonrds.html) for more information.

**Usage**

Because Renovate has no manager for the AWS RDS datasource, you need to help Renovate by configuring the regex manager to identify the RDS dependencies you want updated.

When configuring the regex manager, you have to pass a [filter](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/describedbengineversionscommandinput.html#filters) as minified JSON as the `packageName`.
For example:

```yaml
# Getting the latest supported MySQL 5.7 version from RDS as a filter would look like:

[
  {
    "Name": "engine",
    "Values": [ "mysql" ]
  },
  {
    "Name": "engine-version",
    "Values": [ "5.7" ]
  }
]

# In order to use it with this datasource, you have to minify it:

[{"Name":"engine","Values":["mysql"]},{"Name":"engine-version","Values":["5.7"]}]
```

Here's an example of using the regex manager to configure this datasource:

```json
{
  "regexManagers": [
    {
      "fileMatch": ["\\.yaml$"],
      "matchStrings": [
        ".*amiFilter=(?<lookupName>.+?)[ ]*\n[ ]*(?<depName>[a-zA-Z0-9-_:]*)[ ]*?:[ ]*?[\"|']?(?<currentValue>[.\\d]+)[\"|']?.*"
      ],
      "datasourceTemplate": "aws-rds"
    }
  ]
}
```

The configuration above matches every YAML file, and recognizes these lines:

```yaml
spec:
  # amiFilter=[{"Name":"engine","Values":["mysql"]},{"Name":"engine-version","Values":["5.7"]}]
  engineVersion: 5.7.34
```
