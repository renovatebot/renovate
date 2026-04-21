# Hex V2 Protocol Buffers

TypeScript decoders for the [Hex V2 registry protocol](https://github.com/hexpm/specifications/blob/main/registry-v2.md).

## Proto sources

The `.proto` files are copied from [hexpm/specifications](https://github.com/hexpm/specifications/tree/main/registry):

- `package.proto` — package metadata and releases
- `signed.proto` — signed payload wrapper

Permalink of the revision used is in the first line of each `.proto` file.

## Code generation

The `.ts` files are generated from this directory:

```bash
# install protoc: https://grpc.io/docs/protoc-installation/
cd lib/modules/datasource/hex/v2

protoc \
  --plugin=protoc-gen-ts_proto=$(npx -y -p ts-proto@1.178.0 which protoc-gen-ts_proto) \
  --ts_proto_opt=esModuleInterop=true \
  --ts_proto_opt=enumsAsLiterals=true \
  --ts_proto_opt=importSuffix=.js \
  --ts_proto_opt=outputEncodeMethods=decode-only \
  --ts_proto_opt=outputJsonMethods=from-only \
  --ts_proto_opt=outputPartialMethods=true \
  --ts_proto_out=. \
  package.proto signed.proto
```

Key options:

- `enumsAsLiterals` — const objects instead of TS enums (required for Node.js strip-only TypeScript mode)
- `outputEncodeMethods=decode-only` — only decode, no encode (we only read registry data)
- `outputJsonMethods=from-only` — only fromJSON, no toJSON
