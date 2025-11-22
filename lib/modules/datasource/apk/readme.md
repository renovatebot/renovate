The APK datasource is designed to work with Alpine Linux package repositories. It can fetch package information from APK repositories and provide version updates for Alpine Linux packages.

Alpine Linux uses the APK package manager, and packages are distributed through repositories. Each repository contains an `APKINDEX.tar.gz` file that contains metadata about all available packages.

Files are typically located in this structure:

```
https://dl-cdn.alpinelinux.org/alpine/v3.19/main/x86_64/APKINDEX.tar.gz
https://dl-cdn.alpinelinux.org/alpine/v3.19/community/x86_64/APKINDEX.tar.gz
```

Example APK repository URLs:

- Official Alpine Linux repositories (e.g., `https://dl-cdn.alpinelinux.org/alpine/v3.19/main`)
- Community repositories (e.g., `https://dl-cdn.alpinelinux.org/alpine/v3.19/community`)
- Wolfi APK repositories (e.g., `https://packages.wolfi.dev/os`)

This datasource is used by the [apko manager](../../manager/apko/index.md) to provide version information for packages defined in `apko.yaml` files.
