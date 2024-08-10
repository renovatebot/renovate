This datasource returns releases from a AWS Lambda Layer.

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
  "Sid": "AllowLambdaLayerVersionLookup",
  "Effect": "Allow",
  "Action": ["lambda:ListLayerVersion"],
  "Resource": "*"
}
```

Read the [AWS Lambda IAM reference](https://docs.aws.amazon.com/service-authorization/latest/reference/list_awslambda.html) for more information.

**Usage**

Because Renovate has no manager for the AWS Lambda Layer datasource, you need to help Renovate by configuring the regex manager to identify the layer dependencies you want updated.

Here's an example of using the regex manager to configure this datasource:

```json
{
  "regexManagers": [
    {
      "fileMatch": ["\\.tf$"],
      "matchStringsStrategy": "combination",
      "matchStrings": [
        ".*renovate: datasource=(?<datasource>.*) filter=(?<packageName>.*)\\n\\s*layer_name\\s*=\\s*\"(?<depName>.*)\"\\n\\s*version\\s*=\\s*(?<currentValue>\\d+)"
      ],
      "versioningTemplate": "loose"
    }
  ]
}
```

The configuration above matches every Terraform file, and recognizes the following data source:

```hcl
resource "aws_lambda_function" "example" {
  # ... other configuration ...

  layers = [data.aws_lambda_layer_version.datadog_extension.arn]
}

data "aws_lambda_layer_version" "datadog_extension" {
  # renovate: datasource=aws-lambda-layer filter={"arn": "arn:aws:lambda:us-east-1:464622532012:layer:Datadog-Extension", "architecture": "x86_64", "runtime": "python3.7"}
  layer_name = "arn:aws:lambda:us-east-1:464622532012:layer:Datadog-Extension"
  version = 37
}
```

`architecture` and `runtime` are optional filters that can be used to further narrow down the layer version to be updated (in case there are multiple versions of the same layer for different architectures or runtimes).

**3rd party lambda layers**

In case you are referring to a 3rd party lambda layer, they need to add the necessary permissions to the layer version.
This is done by the 3rd party by running the following command:

```shell
aws lambda add-layer-version-permission --layer-name Datadog-Extension --statement-id allow-version-access \
  --action lambda:ListLayerVersion --principal "*" --version-number your-version-number --output text
```
