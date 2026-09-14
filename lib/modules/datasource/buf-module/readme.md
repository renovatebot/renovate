This datasource looks up commits of [Buf Schema Registry](https://buf.build) modules, e.g. the module dependencies listed in a `buf.yaml`/`buf.lock`.

By default it queries `https://buf.build`. Set `packageName` to `owner/repository`, for example `googleapis/googleapis`.

BSR modules have no semantic versions: a module is an append-only history of immutable commits, each identified by a 32-character commit reference and a `b5:` content digest.
`getReleases` returns that commit history (with the `b5:` digest as `newDigest`), and `getDigest` resolves a module reference — a [label](https://buf.build/docs/bsr/commits-labels/) such as the default `main`, or a pinned commit — to its current commit.
Because commits are opaque, version bumps are driven by digest resolution rather than by version ordering.

## Authentication

If you're hitting rate limits on the public registry, or are querying a private/self-hosted BSR instance, configure a [`hostRules`](../../../configuration-options.md#hostrules) entry with a `token`.
It is sent as a `Bearer` token, the same as `BUF_TOKEN` is used by the `buf` CLI itself.

```json title="Example host rule configuration"
{
  "hostRules": [
    {
      "hostType": "buf-module",
      "matchHost": "https://buf.build",
      "token": "< a buf.build API token >"
    }
  ]
}
```
