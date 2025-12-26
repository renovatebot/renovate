Extracts dependencies from Home Assistant integration `manifest.json` files.

Renovate will check all `manifest.json` files and validate them by checking for required Home Assistant fields (`domain` and `name`).
Non-Home Assistant manifest files (like Chrome extensions) are safely ignored.

Renovate extracts Python package dependencies from the `requirements` key and looks them up using the PyPI datasource.

```json title="Example manifest.json"
{
  "domain": "example",
  "name": "Example Integration",
  "requirements": ["aiohttp==3.9.1", "pydantic==2.5.0"]
}
```

Only pinned versions with the `==` operator are supported.
Other version constraints like `>=1.0.0`, `~=1.0`, or Git references are detected but skipped.
