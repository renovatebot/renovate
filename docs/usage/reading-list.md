# Reading list

Renovate's documentation has a lot of pages.
To ease you into using Renovate we created reading lists.
The reading lists contain the essential information for each type of user.

How much you should read depends on how much you want to customize Renovate's behavior.

## How to use this page

We created reading lists for these types of users:

- Beginners
- Intermediate
- Advanced

Start with the "Beginners" reading list.
If you're self-hosting or need to update private packages, complete the relevant reading lists for those.

## I don't know where to start

If you're new to Renovate, you should:

- Use the Mend Renovate App, or let someone else host Renovate for you
- Stick with the `config:recommended` preset
- Use the Dependency Dashboard (`config:recommended` enables it automatically)
- Read the pages in the "Beginners" list
- Only create custom Renovate configuration when really needed

## Beginners

Start by reading:

- [Installing & Onboarding](./getting-started/installing-onboarding.md)
- [Key concepts, Dependency Dashboard](./key-concepts/dashboard.md)
- [Use Cases](./getting-started/use-cases.md)
- [Running Renovate](./getting-started/running.md)
- [Troubleshooting](./troubleshooting.md)
- [Known limitations](./known-limitations.md)
- [Release notes for major versions](./release-notes-for-major-versions.md)

## Intermediate

First, complete the "Beginners" reading list.
Read this list _after_ experiencing Renovate's default behavior, once you really want/need to make changes to Renovate's behavior.

- [Key concepts, presets](./key-concepts/presets.md)
- [Key concepts, Renovate scheduling](./key-concepts/scheduling.md)
- [Key concepts, automerge](./key-concepts/automerge.md)
- [Key concepts, pull requests](./key-concepts/pull-requests.md)
- [Noise Reduction](./noise-reduction.md)

Skim the [repository configuration options](./configuration-options.md) to learn about the kind of customizations you can make to Renovate.
Feel free to read up on anything that looks interesting to you.

## Advanced

First, complete the "Beginners" and the "Intermediate" reading list.
Then read:

- Define your own regex manager with [`regexManagers`](./configuration-options.md#regexmanagers)
- [Shareable config presets](./config-presets.md)

## Self-hosting Renovate

If you're going to self-host Renovate then read:

- [Self-hosting examples](./examples/self-hosting.md)
- Skim the [self hosted configuration options](./self-hosted-configuration.md)

## Private packages

If you want Renovate to update private packages then read:

- [Private package support](./getting-started/private-packages.md)
