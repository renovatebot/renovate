Add to this configuration object if you need to override any of the Kubernetes manager default settings. Use the `docker` config object instead if you wish for configuration to apply across all Docker-related package managers.

It's important to note that the `kubernetes` manager by default has no `fileMatch` defined - i.e. so it will never match any files unless you configure it. This is because there is no commonly accepted file/directory naming convention for Kubernetes YAML files and we don't want to download every single `*.yaml` file in repositories just in case any of them contain Kubernetes definitions.

If most `.yaml` files in your repository are Kubnernetes ones, then you could add this to your config:

```json
{
  "kubernetes": {
    "fileMatch": ["\\.yaml$"]
  }
}
```

If instead you have them all inside a `k8s/` directory, you would add this:

```json
{
  "kubernetes": {
    "fileMatch": ["k8s/.+\\.yaml$"]
  }
}
```

Or if it's just a single file then something like this:

```json
{
  "kubernetes": {
    "fileMatch": ["^config/k8s\\.yaml$"]
  }
}
```
