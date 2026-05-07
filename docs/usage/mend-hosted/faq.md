# Frequently Asked Questions

## I'm hitting a `timeout` / `kernel-out-of-memory` limit with a `pnpm`/`yarn` project

If you're seeing that your jobs are regularly hitting a `timeout` / `kernel-out-of-memory`, this might be due to a package manager trying to update a large set of dependencies.

On Mend-hosted apps, it is recommended to use the repo-level configuration, [`toolSettings.nodeMaxMemory`](../configuration-options.md#toolsettingsnodemaxmemory), to tune the maximum memory available for the `pnpm`/`yarn` commands to use this.

Mend-hosted apps don't set a maximum allowed `nodeMaxMemory`, so you can use [the upper limit of memory from your plan](./overview.md#resources-and-scheduling) as the maximum limit.

It is recommended to set this between 1.5GB and 2.5GB but may require tweaking according to your repository.

<!-- prettier-ignore -->
!!! note
    It is at the discretion of Mend to raise the memory limit for repositories, in a similar way to how [there are increased resources for Open Source projects on Renovate Cloud](https://github.com/renovatebot/renovate/discussions/33617).

## What IP Addresses are used by Mend Renovate Cloud?

If you are looking at restricting access to your source code via IP allowlisting, you will need to know which public IPs Mend's Developer Platform accesses from.

These can be found documented [on the Mend docs site](https://docs.mend.io/platform/latest/ip-addresses-used-by-mend-io) under the `developer-platform` section.

- the `us` grouping is for [`developer.mend.io`](https://developer.mend.io/)
- the `eu` grouping is for [`developer-eu.mend.io/`](https://developer-eu.mend.io/)
