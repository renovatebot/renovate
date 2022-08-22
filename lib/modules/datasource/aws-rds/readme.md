This datasource returns the database engine versions available for use on [AWS RDS](https://aws.amazon.com/rds/) via the AWS API.
These generally track publicly released database versions, though new versions may not be available on RDS for a few weeks or months after their release while AWS tests them, and existing versions may be pulled by AWS if serious problems arise during their use.

Because the datasource uses the AWS-SDK for JavaScript, you can configure it like other AWS Tools.
You can use common AWS configuration options, for example (partial list):

- Setting the region via `AWS_REGION` (environment variable) or your `~/.aws/config` file
- Provide credentials via `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` (environment variable) or your `~/.aws/credentials` file
- Select the profile to use via `AWS_PROFILE` environment variable

Read the [Developer guide](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/configuring-the-jssdk.html) for more information on configuration options.

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

Because there is no general `packageName`, you have to pass a [filter](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/describedbengineversionscommandinput.html#filters) as minified JSON as the `packageName`.

Example:

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

At the moment, this datasource has no "manager".
You have to use the regex manager for this.

**Usage Example**

Here's an example of using the regex manager to configure this datasource:

```json
"regexManagers": [
    {
        "fileMatch": [
            "\\.yaml$"
        ],
        "matchStrings": [
            ".*amiFilter=(?<lookupName>.+?)[ ]*\n[ ]*(?<depName>[a-zA-Z0-9-_:]*)[ ]*?:[ ]*?[\"|']?(?<currentValue>[.\\d]+)[\"|']?.*"
        ],
        "datasourceTemplate": "aws-rds"
    }
]
```

This would match every YAML file, and would recognize the following lines:

```yaml
spec:
  # amiFilter=[{"Name":"engine","Values":["mysql"]}]
  engineVersion: 8.0.24
```
