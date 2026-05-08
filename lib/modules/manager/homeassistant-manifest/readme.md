The Home Assistant Manifest manager updates the `requirements` field in Home Assistant integration `manifest.json` files.

```json title="Example manifest.json"
{
  "domain": "my_integration",
  "name": "My Integration",
  "requirements": ["aiohttp==3.9.1", "pydantic>=2.5.0"]
}
```
