The Jenkins manager supports the following format of the plugin list:

Text:

```text
plugin1:1.2.3
plugin2:4.5 # this is a comment

# this line is ignored

# Renovate will not upgrade the following dependency:
plugin3:7.8.9 # renovate:ignore
```

Yaml:

```yaml
---
- plugin1:1.2.3
- plugin2:4.5 # this is a comment

# this line is ignored

# Renovate will not upgrade the following dependency:
- plugin3:7.8.9 # renovate:ignore
```

There's no strict specification on the name of the files, but usually it's `plugins.txt`
