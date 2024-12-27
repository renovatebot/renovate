The EKS `datasource` is designed to query one or more [AWS EKS](https://docs.aws.amazon.com/eks/latest/userguide/platform-versions.html) via the AWS API.

**AWS API configuration**

Since the datasource uses the AWS SDK for JavaScript, you can configure it like other AWS Tools.
You can use common AWS configuration options, for example:

- Specifies the AWS region where your resources are located. This is crucial for routing requests to the correct endpoint.
  - Set the region via the `AWS_REGION` environment variable
  - Pass the `region` option to Renovate
- Read credentials from environment variables (e.g., `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`).
- Load credentials from the shared credentials file (~/.aws/credentials).
- Use IAM roles for EC2 instances or Lambda functions.
- A chain of credential providers that the SDK attempts in order.

The minimal IAM privileges required for this datasource are:

```json
{
  "Effect": "Allow",
  "Action": ["eks:DescribeClusterVersions"],
  "Resource": "*"
}
```

Read the [AWS EKS IAM reference](https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazonelastickubernetesservice.html) for more information.

**Usage**

Because Renovate has no manager for the AWS EKS datasource, you need to help Renovate by configuring the custom manager to identify the AWS EKS configuration you want updated.

Configuration Options

```yaml
# discover all available eks versions.
renovate: eksFilter={}

# discover default eks versions
renovate: eksFilter={"default":true}

# discover all available eks versions in us-east-1 region using environmental AWS credentials. Region is a recommended option.
renovate: eksFilter={"region":"eu-west-1"}

# discover all available eks versions in us-east-1 region using AWS credentials from `renovate-east` profile.
renovate: eksFilter={"region":"us-east-1","profile":"renovate-east"}
```

```json
{
  "packageRules": [
    {
      "matchDatasources": ["aws-eks"],
      "prBodyColumns": ["Package", "Update", "Change", "Sources", "Changelog"],
      "prBodyDefinitions": {
        "Sources": "[▶️](https://github.com/aws/eks-distro/)",
        "Changelog": "[▶️](https://github.com/kubernetes/kubernetes/blob/master/CHANGELOG/CHANGELOG-{{{newVersion}}}.md)"
      }
    }
  ],
  "customManagers": [
    {
      "customType": "regex",
      "fileMatch": [".*\\.tf"],
      "matchStrings": [
        ".*# renovate: eksFilter=(?<packageName>.*?)\n.*?[a-zA-Z0-9-_:]*[ ]*?[:|=][ ]*?[\"|']?(?<currentValue>[a-zA-Z0-9-_.]+)[\"|']?.*"
      ],
      "datasourceTemplate": "aws-eks",
      "versioningTemplate": "loose" // aws-eks versioning is not yet supported
    }
  ]
}
```

The configuration above matches every terraform file, and recognizes these lines:

```hcl
variable "eks_version" {
  type        = string
  description = "EKS vpc-cni add-on version"
  # region provided
  # renovate: eksFilter={"region":"eu-west-1"}
  default     = "1.24"
}
```

```yml
clusters:
  - name: main
    # only default version
    # renovate: eksFilter={"default":true}
    version: 1.24
  - name: tier-1
    # region and where or not only default versions
    # renovate: eksFilter={"default":"false", "region":"eu-west-1"}
    version: 1.28
```

**Cluster Upgrade**

- [AWS EKS cluster upgrade best practices](https://docs.aws.amazon.com/eks/latest/best-practices/cluster-upgrades.html)

At the moment there is no `aws-eks` versioning. The recommended approach is to upgrade to next minor version

When performing an in-place cluster upgrade, it is important to note that only one minor version upgrade can be executed at a time (e.g., from 1.24 to 1.25). This means that if you need to update multiple versions, a series of sequential upgrades will be required.

Correct

```diff
- version: 1.24
+ version: 1.25
```

Will not work

```diff
- version: 1.24
+ version: 1.27
```
