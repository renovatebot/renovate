## Hex Datasource

Hex registries use protobuf encoding for packages in all registries. An HTTP API
such as that exposed by [hex.pm](https://hex.pm) is not a requirement for running a registry.
Therefore, all registries have the protobuf encoded endpoint exposed but not all
registries expose a HTTP API exposing additional metadata.

As a practical example, Oban Pro runs its own registry but does not have the same
API functionality as hex.pm.

In order to support all registries, the protobuf encoded method of fetching package
information is the base operation. As noted, the information exposed by that method
is not as rich as hex.pm's. In the case that the repository is hex.pm, additional
metadata is fetched from there to enrich the package information. For example, the
protobufs do not contain `links` metadata, so changelogs can not be discovered.

### Registry Proto Generation

Hex registry protobuf definitions are housed in the [Hex Specification Repo](https://github.com/hexpm/specifications/tree/main/registry).
A copy of the necessary protos are copied in the the `protos` directory of this datasource.

To update the generated files:

```js
pnpm codegen:hex-datasource-protobuf
```

The protobuf definitions are highly stable and unlikely to change, so this should only
be necessary if a bug is discovered.
