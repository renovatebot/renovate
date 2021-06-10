The `pip-compile` manager is in "alpha" release, this means it's not ready for production use.
Try at your own risk.
We welcome feedback and bug reports!

The current implementation has some limitations.
Read the full document before you start using the `pip-compile` manager.

### Non-configured fileMatch

The `pip-compile` manager has an empty array for default `fileMatch`, meaning it won't match any files ever by default.
You can "activate" the manager by specifying a `fileMatch` pattern such as:

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

By default Renovate uses the latest version of Python.
To get Renovate to use another version of Python, add a contraints` rule to the Renovate config:

```json
{
  "constraints": {
    "python": "3.7"
  }
}
```
