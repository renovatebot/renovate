Keeps the [asdf](https://asdf-vm.com/manage/configuration.html#tool-versions)
`.tools-versions` file updated.

Because `asdf` supports the version management of many different tools, specific tool support needs to be added one by one.

Only the following tools are currently supported

- [nodejs](https://github.com/asdf-vm/asdf-nodejs)

NOTE: Because `.tools-versions` can support fallback versions only the first version entry for each supported tool is managed
