This `datasource` returns the addon versions available for use on [AWS EKS](https://aws.amazon.com/eks/) via the AWS API.

**AWS API configuration**

- [Amazon EKS add-ons](https://docs.aws.amazon.com/eks/latest/userguide/eks-add-ons.html)
- [Available Amazon EKS add-ons from AWS](https://docs.aws.amazon.com/eks/latest/userguide/workloads-add-ons-available-eks.html)

Since the datasource uses the AWS SDK for JavaScript, you can configure it like other AWS Tools.
You can use common AWS configuration options, for example:

- Set the region via the `AWS_REGION` environment variable or your `~/.aws/config` file
- Provide credentials via the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment variables or your `~/.aws/credentials` file
- Select the profile to use via `AWS_PROFILE` environment variable

Alternatively, you can specify different `region` and `profile` for each addon.

Read the [AWS Developer Guide - Configuring the SDK for JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/configuring-the-jssdk.html) for more information on these configuration options.

The minimal IAM privileges required for this datasource are:

```json
{
  "Sid": "AllowDescribeEKSAddonVersions",
  "Effect": "Allow",
  "Action": ["eks:DescribeAddonVersions"],
  "Resource": "*"
}
```

Read the [AWS EKS IAM reference](https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazonelastickubernetesservice.html) for more information.

**Usage**

Because Renovate has no manager for the AWS EKS Addon datasource, you need to help Renovate by configuring the custom manager to identify the AWS EKS Addons you want updated.

When configuring the custom manager, you have to pass in the Kubernetes version and addon names as a minified JSON object as the `packageName`
For example:

```yaml
# Getting the vpc-cni version for Kubernetes 1.30
{
   "kubernetesVersion": "1.30",
   "addonName": "vpc-cni"
}

# In order to use it with this datasource, you have to minify it:
{"kubernetesVersion":"1.30","addonName":"vpc-cni"}
```

Although it's unlikely that EKS might support different addon versions across regions, you can optionally specify the `region` and/or `profile` in the minified JSON object to discover the addon versions specific to this region.

```yaml
# discover kube-proxy addon versions without specifying a cluster version.
renovate: eksAddonsFilter={"addonName":"kube-proxy"}

# discover kube-proxy default addon versions
renovate: eksAddonsFilter={"addonName":"kube-proxy", "default":true}

# discover vpc-cni addon versions on Kubernetes 1.30 in us-east-1 region using environmental AWS credentials.
renovate: eksAddonsFilter={"kubernetesVersion":"1.30","addonName":"vpc-cni","region":"eu-west-1"}

# discover vpc-cni addon versions on Kubernetes 1.30 in us-east-1 region using AWS credentials from `renovate-east` profile.
renovate: eksAddonsFilter={"kubernetesVersion":"1.30","addonName":"vpc-cni","region":"us-east-1","profile":"renovate-east"}
```

Here's an example of using the custom manager to configure this datasource:

```js
{
  "packageRules": [
    {
      "matchDatasources": ["aws-eks-addon"]
    }
  ],
  "customManagers": [
    {
      "customType": "regex",
      "fileMatch": [".*\\.tf"],
      "matchStrings": [
        ".*# renovate: eksAddonsFilter=(?<packageName>.*?)\n.*?[a-zA-Z0-9-_:]*[ ]*?[:|=][ ]*?[\"|']?(?<currentValue>[a-zA-Z0-9-_.]+)[\"|']?.*"
      ],
      "datasourceTemplate": "aws-eks-addon",
      "versioningTemplate": "aws-eks-addon" // Optional. Default value is 'aws-eks-addon'
    }
  ]
}
```

The configuration above matches every terraform file, and recognizes these lines:

```hcl
variable "vpc_cni_version" {
  type        = string
  description = "EKS vpc-cni add-on version"
  # kubernetesVersion and addonName provided
  # renovate: eksAddonsFilter={"kubernetesVersion":"1.30","addonName":"vpc-cni"}
  default     = "v1.18.1-eksbuild.3"
}
```

or

```yml
addons:
  - name: vpc-cni
    # only addon name and the supported default version
    # renovate: eksAddonsFilter={"addonName":"vpc-cni", "default":true}
    version: v1.18.5-eksbuild.1
```
