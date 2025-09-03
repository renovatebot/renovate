This datasource `rpm` returns releases of the RPM packages.
It assumes the RPM repository is following the RPM standard and by default it has a repomd.xml in the directory provided by user in the `registryUrl`.
According to this Pulp project doc, <https://docs.pulpproject.org/en/2.10/plugins/pulp_rpm/tech-reference/rpm.html>,

> repomd.xml is the metadata file that clients use to discover what repository metadata files exist in the repository.
> It should always be located at repodata/repomd.xml relative to the root of the repository.

## Set URL when using an RPM repository

To use an RPM repository with the datasource, you must set a `registryUrl` with the directory that contains the `repomd.xml` and corresponding `primary.xml`.

**Example**:

If we have

- `http://example.com/repo/repodata/repomd.xml`
- `http://example.com/repo/repodata/<SHA256>-primary.xml` where `<SHA256>` is a dynamically generated SHA256 pattern.

Then the `registryUrl` should set as `http://example.com/repo/repodata/` or `http://example.com/repo/repodata`.

## Usage Example

Say you're defining dnf/tdnf/yum packages in a `manifest.json` and you want Renovate to update them.

Assuming your `manifest.json` looks like this.

```manifest.json
{
  "package1": "1.0.0-1",
  "package2": "1.1.0"
}
```

where the versioning format could be `<semantic version>-<revision or release>`, or just `<semantic version>`

```renovate.json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "customManagers": [
    {
      "customType": "regex",
      "fileMatch": [
        "path_to_manifest_json"
      ],
      "registryUrlTemplate": "http://example.com/repo/repodata/",
      "datasourceTemplate": "rpm"
    }
  ]
}
```

In an RPM repository, the `<SHA256>-primary.xml` looks like this:

```
`<?xml version="1.0" encoding="UTF-8"?>
<metadata xmlns="http://linux.duke.edu/metadata/common">
  <package type="rpm">
    <name>example-package</name>
    <arch>x86_64</arch>
    <version epoch="0" ver="1.0" rel="2.azl3"/>
  </package>
  <package type="rpm">
    <name>example-package</name>
    <arch>x86_64</arch>
    <version epoch="0" ver="1.1" rel="1.azl3"/>
  </package>
  <package type="rpm">
    <name>example-package</name>
    <arch>x86_64</arch>
    <version epoch="0" ver="1.1" rel="2.azl3"/>
  </package>
  <package type="rpm">
    <name>example-package</name>
    <arch>x86_64</arch>
    <version epoch="0" ver="1.2"/>
  </package>
...
...
</metadata>
```

You can see that `ver` and `rel` (release/revision) is stored separately.
But the RPM datasource implementation will combine these together as `ver-rel`.
That's why in the `manifest.json` above, the version is defined as `1.0.0-1`, if `rel` is available.
Or just `1.1.0` if `rel` is not available.

## Limitation and Consideration

In real-world scenarios, the decompressed `primary.xml` file from an RPM repository can be extremely large.
To handle this efficiently, this implementation uses streaming XML parsing, which processes the file incrementally and avoids loading the entire XML into memory.

Streaming XML parsing is a practical solution for large files in Node.js, but for extremely large or complex cases (e.g., files exceeding ~512MB), you may still encounter memory or performance issues.
For such scenarios, consider using more robust approaches such as native modules, optimized SAX parsers, or external tools.
Contributions and suggestions for further improving large file handling are welcome.
