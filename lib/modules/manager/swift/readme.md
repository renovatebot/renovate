Anything other than `.exact(<...>)` or `exact:<...>` will be treated as range with respect to Swift specific.
Because of this, some PR descriptions will look like `from: <...> => <...>`.

Examples:

```swift
package(name: "<...>", .exact("1.2.3"))   // => 1.2.3
package(name: "<...>", exact: "1.2.3")    // => 1.2.3
package(name: "<...>", from: "1.2.3")     // => from: "2.0.0"
package(name: "<...>", "1.2.3"...)        // => "2.0.0"...
package(name: "<...>", "1.2.3"..."1.3.0") // => "1.2.3"..."2.0.0"
package(name: "<...>", "1.2.3"..<"1.3.0") // => "1.2.3"..<"2.0.0"
package(name: "<...>", ..."1.2.3")        // => ..."2.0.0"
package(name: "<...>", ..<"1.2.3")        // => ..<"2.0.0"
```

### Swift Package Registry (SE-0292)

Renovate recognizes the SE-0292 identity form alongside the URL form:

```swift
.package(id: "scope.name", from: "1.0.0"),
```

Identity-form dependencies are resolved against the `swift-package-registry` datasource. Registry URLs are auto-discovered from `.swiftpm/configuration/registries.json` in the same directory as the `Package.swift`:

```json {title="Example registries.json" configType=none}
{
  "registries": {
    "[default]": { "url": "https://registry.example.com" }
  },
  "version": 1
}
```

Configure authentication with a `hostRules` entry whose `hostType` matches the datasource ID — `swift-package-registry`. Bearer tokens and basic auth are both supported.

`Package.resolved` pins of `kind: "registry"` are updated in place (only the `state.version` field). Legacy `kind: "remoteSourceControl"` pins that correspond to a registry-form dependency are also matched by identity for the version update.
