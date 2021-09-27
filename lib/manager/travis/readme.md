This manager is intended to keep Travis config files (`.travis.yml`) up-to-date, this file controls the CI build environment.
Currently Renovate can only update the `node_js` section of this file.

An important limitation is that Renovate does not currently "understand" [Travis's Build Matrix concept](https://docs.travis-ci.com/user/build-matrix/#matrix-expansion), so it will try to update all found Node.js versions to the latest LTS, e.g.

```diff
node_js:
-  - 8.10.0
-  - 10.10.0
+  - 14.17.4
+  - 14.17.4
```

Due to this, major updates for Travis are disabled by default.
If you enable major updates and use a version matrix, then you will likely need to manually fix any major update PRs raised by Renovate.
Here's how to enable major updates in your Renovate config:

```json
{
  "travis": {
    "major": {
      "enabled": true
    }
  }
}
```

If you would like to see "build matrix" support in future, please contribute ideas to [issue #11175](https://github.com/renovatebot/renovate/issues/11175).
