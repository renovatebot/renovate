This versioning is used exclusively for the `go` directive in `go.mod` files.

It ensures that a value like `1.16` is treated like `^1.16` and not `~1.16`.

By default this will mean that the `go` directive in `go.mod` files won't get upgraded to any new Go version, such as `1.19`.
If you wish to upgrade this value every time there's a new minor Go release, configure `rangeStrategy` to be `"bump"` like so:

```json
{
  "packageRules": [
    {
      "matchDatasources": ["golang-version"],
      "rangeStrategy": "bump"
    }
  ]
}
```
