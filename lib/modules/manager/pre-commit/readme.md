_Important note_: The `pre-commit` manager is disabled by default and must be opted into through config.
Renovate's approach to version updating is not fully aligned with `pre-commit autoupdate` and this has caused frustration for `pre-commit`'s creator/maintainer.
Attempts to work with the `pre-commit` project to fix these gaps have been rejected, so we have chosen to disable the manager by default indefinitely.
Please do not contact the `pre-commit` project/maintainer about any Renovate-related topic.
To view a list of open issues related to the `pre-commit` manager in Renovate, see the [filtered list using the `manager:pre-commit` label](https://github.com/renovatebot/renovate/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+label%3Amanager%3Apre-commit).

When enabled, Renovate supports updating of Git dependencies within pre-commit configuration `.pre-commit-config.yaml` files or other YAML files that use the same format (via `fileMatch` configuration).
Updates are performed if the files follow the conventional format used in typical pre-commit files:

```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v1.0.0
    hooks:
      - id: some-hook-id
```

To enable the `pre-commit` manager, add the following config:

```json
{
  "pre-commit": {
    "enabled": true
  }
}
```

Alternatively, add `:enablePreCommit` to your `extends` array.

### Additional Dependencies

renovate has partial support for `additional_dependencies`, currently python only.

for python hooks, you will need to **explicitly add language** to your hooks with `additional_dependencies`
to let renovatebot know what kind of dependencies they are.

For example, this work for `request`:

```yaml
- repo: https://github.com/psf/black
  rev: 19.3b0
  hooks:
    - id: black
      language: python
      additional_dependencies:
        - 'request==1.1.1'
```

this won't work:

```yaml
- repo: https://github.com/psf/black
  rev: 19.3b0
  hooks:
    - id: black
      additional_dependencies:
        - 'request==1.1.1'
```
