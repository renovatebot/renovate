This datasource looks up versions of [Buf Schema Registry](https://buf.build) curated remote plugins, e.g. the plugins referenced by `buf.gen.yaml`'s `remote` field.

By default it queries `https://buf.build`. Set `packageName` to `owner/name`, for example `bufbuild/connect-go`.

The Buf Schema Registry only reports deprecation status for the single latest version of a plugin, so only that release is ever flagged as `isDeprecated` in the results.

## Authentication

If you're hitting rate limits on the public registry, or are querying a private/self-hosted BSR instance, configure a [`hostRules`](../../../configuration-options.md#hostrules) entry with a `token`.
It is sent as a `Bearer` token, the same as `BUF_TOKEN` is used by the `buf` CLI itself.

```json title="Example host rule configuration"
{
  "hostRules": [
    {
      "hostType": "buf-plugin",
      "matchHost": "https://buf.build",
      "token": "< a buf.build API token >"
    }
  ]
}
```
