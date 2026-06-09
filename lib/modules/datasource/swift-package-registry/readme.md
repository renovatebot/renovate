[Swift Package Registry](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0292-package-registry.md) is the HTTP protocol SwiftPM uses to resolve identity-form dependencies declared as `.package(id: "scope.name", …)`.

This datasource queries the SE-0292 "list package releases" endpoint:

```
GET <registry>/<scope>/<name>
Accept: application/vnd.swift.registry.v1+json
```

Registry URLs are typically auto-discovered by the `swift` manager from `.swiftpm/configuration/registries.json` in the repository (project- and workspace-level locations are both checked). You can also set `customRegistryUrls` or use `hostRules` to point Renovate at a specific registry.

### Authentication

Configure authentication with a `hostRules` entry that sets `hostType` to `swift-package-registry`. Bearer-token registries and basic-auth registries are both supported:

```json
{
  "hostRules": [
    {
      "hostType": "swift-package-registry",
      "matchHost": "registry.example.com",
      "token": "<bearer-token>"
    }
  ]
}
```

For basic auth, use `username` and `password` instead of `token`.
