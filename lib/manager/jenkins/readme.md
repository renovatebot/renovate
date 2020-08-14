The Jenkins manager suppports the following format of the plugin list:

```text
plugin1:1.2.3
plugin2:4.5 # this is a comment

# this line is ignored

plugin3:7.8.9 # [renovate-ignore] Renovate will not upgrade this
```

You can specify a custom `ignoreComments` in your manager config to set a custom value for comment string that
will be used to detect ignored packages, e.g.:

```
"ignoreComments": ["[ignore-renovate]", "[pin]"]
```

There's no strict specification on the name of the files, but usually it's `plugins.txt`
