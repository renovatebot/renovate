[endoflife.date](https://endoflife.date) provides version and end-of-life information for different packages.

It can provided detailed updates for aws-lambda serverless versions by requesting the aws-lambda specific endoflife.date information.

The aws-lambda endoflife.date information is special in that the package name must be used to filter the specific lambda functions by type.

By default, this datasource uses the aws-lambda api response from the endoflife.date API endpoint. You can find it in [the endoflife.date API documentation](https://endoflife.date/docs/api).
By default, this datasource uses `loose` versioning.
If possible, we recommend you use a stricter versioning like `semver` instead of `loose`.

**Usage Example**

Say for example you are using aws lambda functions with a customized platform application specification file passed to your CI/CD tool.
For example, you have this `platform-appspec.yaml` file, and you would like to migrate from go1.x to provided.al2 and upgrade from nodejs16.x to nodejs18.x:

```yml
---
lambdas:
  version: 0.0.2
  lambda_functions:
    - function: 'test-main-lambda-go'
      runtime: 'go1.x'
      handler: 'main.lambda_handler'
      description: 'Update info-main process'
      source_dir: 'src'
      vpc_attached: True
      egress_rules:
        - proto: tcp
          ports:
            - 443
            - 5432
            - 1433
            - 55010
          cidr_ip: 0.0.0.0/0
          rule_desc: 'access to aws services needed'
      environment_variables:
        ENV: "{{ env }}"
        CUSTOMER: 'tst'
        DEBUG: "{{ debug | default('false') }}"
      memory_size: 1024
      timeout: 900
    - function: 'test-main-lambda-nodejs'
      runtime: 'nodejs16.x'
      handler: 'main.lambda_handler'
      description: 'Update info-main process'
      source_dir: 'src'
      vpc_attached: True
      egress_rules:
        - proto: tcp
          ports:
            - 443
            - 5432
            - 1433
            - 55010
          cidr_ip: 0.0.0.0/0
          rule_desc: 'access to aws services needed'
      environment_variables:
        ENV: "{{ env }}"
        CUSTOMER: 'tst'
        DEBUG: "{{ debug | default('false') }}"
      memory_size: 1024
      timeout: 900
```

Given the above `platform-appspec.yml` file, you put this in your `renovate.json`:

```json
{
  "packageRules": [
    {
      "description": "replace deprecated go1.x lambda with provided.al2",
      "matchDatasources": "endoflife-date-aws-lambda",
      "matchPackageNames": ["go"],
      "matchCurrentValue": "/^1.x/",
      "replacementName": "provided.",
      "replacementVersion": "al2"
    },
    {
      "description": "pin nodejs lambda version below 20",
      "matchDatasources": "endoflife-date-aws-lambda",
      "matchPackageNames": ["nodejs"],
      "allowedVersions": "<20.x"
    }
  ],
  "customManagers": [
    {
      "customType": "regex",
      "description": "Updates aws lambda versions in custom platform appspec",
      "fileMatch": "platform-appspec.yml",
      "matchStrings": [
        "runtime:\\s*'(?<depName>(go|provided\\.|java|python|nodejs))(?<currentValue>[a-z,0-9]*.[0-9,x]*)'"
      ],
      "autoReplaceStringTemplate": "runtime: '{{depName}}{{newVersion}}'",
      "datasourceTemplate": "endoflife-date-aws-lambda"
    }
  ]
}
```

With this configuration, Renovate will parse all `platform-appspec.yml` files in the repository.
It will then update the runtime strings replacing `go1.x` with `provided.al2` and `nodejs16.x` with `nodejs18.x`.
