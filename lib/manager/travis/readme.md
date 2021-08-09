This manager is intended to keep Travis config files (`.travis.yml`) up-to-date.
Currently it manages only the `node_js` section of files only.

An important limitation to note is that Renovate does not currently "understand" Travis's node matrix concept, so it will try to update all found node versions to the latest LTS, e.g.

```diff
node_js:
-  - 8.10.0
-  - 10.10.0
+  - 14.17.4
+  - 14.17.4
```

Due to this, major updates for Travis are disabled by default.
If you enable major updates and use a version matrix, then you will likely need to manually fix any major update PRs raised by Renovate.
You can major updates them this way in config:

```json
{
  "travis": {
    "major": {
      "enabled": true
    }
  }
}
```

If you would like to see "build matrix" support in future, please contribute ideas to [Issue #11175](https://github.com/renovatebot/renovate/issues/11175).
