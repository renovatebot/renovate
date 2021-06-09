This `pip-compile` manager is still in "alpha" mode, so your feedback is welcome.

Please note the following limitations:

### Non-configured fileMatch

The `pip-compile` manager has an empty array for default `fileMatch`, meaning it won't match any files ever by default.
You can therefore "activate" the manager by specifying a `fileMatch` pattern such as:

```json
{
  "pip-compile": {
    "fileMatch": ["(^|/)requirements\\.in$"]
  }
}
```

### Assumption of `.in`/`.txt`

If Renovate matches/extracts a file, it assumes that the corresponding output file is found by swapping the `.in` for `.txt`.
e.g. `requirements.in` => `requirements.txt`

Therefore it will not work if files are in separate directories, including `input/requirements.in` and `output/requirements.txt`.

### Configuration of Python version

Renovate will default to the latest Python version, so to use a lesser one you should configure like the following in your repository config:

```json
{
  "constraints": {
    "python": "3.7"
  }
}
```
