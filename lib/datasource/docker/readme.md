If you're using a Docker registry proxy, the proxy likely won't support the API required for Renovate to detect new versions.
In this case, you should use `packageRules` to change the `registryUrls` to Docker Hub so Renovate will use it as the tag source.

For example, if your `Dockerfile` looks like this:

```dockerfile
FROM registry.example.com/proxy-cache/library/node:12.19.1
```

Then you could use the following configuration so that Renovate queries Docker Hub instead:

```json
{
  "packageRules": [
    {
      "matchDatasources": ["docker"],
      "registryUrls": ["https://index.docker.io"]
    }
  ]
}
```
