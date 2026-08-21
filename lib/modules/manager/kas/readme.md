Renovate supports upgrading dependencies in [kas files](https://github.com/siemens/kas/).
Please refer to the [kas Project Configuration](https://kas.readthedocs.io/en/latest/userguide/project-configuration.html) to learn more.

By default, Renovate does not scan for kas configuration files, as these can be any YAML or JSON file.

Use the `managerFilePatterns` configuration option to specify the entry-point kas files.
These entry-point files can then include many more kas files, which should not be specified individually here.

```json
{
  "kas": {
    "managerFilePatterns": ["kas.yml"]
  }
}
```
