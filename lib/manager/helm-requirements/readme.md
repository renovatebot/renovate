Renovate supports updating Helm Chart references within `requirements.yaml` files.

If your Helm charts make use of Aliases then you will need to configure an `aliases` object in your config to tell Renovate where to look for them.

If you need to change the versioning format, read the [versioning](https://docs.renovatebot.com/modules/versioning/) documentation to learn more.

Maybe you're running your own ChartMuseum server to host your private Helm Charts.
This is how you connect to a private Helm repository:

```js
module.exports = {
  hostRules: [
    {
      matchHost: 'your.host.io',
      hostType: 'helm'
      username: '<your-username>',
      password: process.env.SELF_HOSTED_HELM_CHARTS_PASSWORD,
    },
  ],
};
```

If you need to configure per-repository credentials then you can also configure the above within a repository's Renovate config (e.g. `renovate.json`).
