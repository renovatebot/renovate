Due to limited functionality, the `pip-compile` manager should be considered in an "alpha" stage, which means it's not ready for production use for the majority of end users.
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
It will not work if files are in separate directories, including `input/requirements.in` and `output/requirements.txt`.

If no `.in` suffix is found, then a `.txt` suffix is appended for the output file, e.g. `foo.file` would look for a corresponding `foo.file.txt`.

We intend to make the mapping configurable in future iterations.

### Configuration of Python version

By default Renovate uses the latest version of Python.
To get Renovate to use another version of Python, add a constraints` rule to the Renovate config:

```json
{
  "constraints": {
    "python": "==3.7"
  }
}
```

### `pip-compile` arguments

Renovate reads the `requirements.txt` file and extracts these `pip-compile` arguments:

- `--generate-hashes`
- `--allow-unsafe`
- `--no-emit-index-url`
- `--strip-extras`
- `--resolver`
