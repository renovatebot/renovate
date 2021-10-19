The `helmsman` manager is currently limited and does not support the full feature set of [Helmsman](https://github.com/Praqma/helmsman), please consult the documented limitations.

### Non-configured fileMatch

The `helmsman` manager has an empty array for default `fileMatch`, meaning it won't match any files ever by default.
You can "activate" the manager by specifying a `fileMatch` pattern such as:

```json
{
  "helmsman": {
    "fileMatch": ["(^|/)desired_state\\.yaml$"]
  }
}
```

### File format

Currently, state files have to be in the `yaml` format.
The `toml` format is not supported.
