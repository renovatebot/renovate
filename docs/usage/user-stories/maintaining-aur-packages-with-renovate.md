---
title: Maintaining AUR packages with Renovate
---

<!-- hide table of contents in navigation sidebar -->
<style>
.md-nav--primary .md-nav__link[for=__toc] ~ .md-nav {
    display: none;
}
</style>

# Maintaining AUR packages with Renovate

> This article was written by [Jamie Magee](https://github.com/JamieMagee) and originally published on [Jamie Magee's blog](https://jamiemagee.co.uk/blog/maintaining-aur-packages-with-renovate/).

<!-- prettier-ignore -->
!!! note
    Jamie Magee helps to maintain Renovate.
    They obviously like Renovate, and want you to use it.

One big advantage that Arch Linux has over other distributions, apart from being able to say “BTW I use Arch.”, is the Arch User Repository (AUR).
It’s a community-driven repository with over 80,000 packages.
If you’re looking for a package, chances are you'll find it in the AUR.

Keeping all those packages up to date, takes a lot of manual effort by a lot of volunteers.
People have created and used tools, like [`urlwatch`](https://github.com/thp/urlwatch) and [`aurpublish`](https://github.com/eli-schwartz/aurpublish), to let them know when upstream releases are cut and automate some parts of the process.
I know I do.
But I wanted to automate the entire process.
I think [Renovate](https://github.com/renovatebot/renovate/) can help here.

## Updating versions with Renovate

Renovate is an automated dependency update tool.
You might have seen it opening pull requests on GitHub and making updates for npm or other package managers, but it’s a lot more powerful than just that.

Renovate has a couple of concepts that I need to explain first: [datasources](../modules/datasource/index.md) and [managers](../modules/manager/index.md).
Datasources define where to look for new versions of a dependency.
Renovate comes with over 50 different datasources, but the one that is important for AUR packages is the [`git-tags` datasource](https://docs.renovatebot.com/modules/datasource/#git-tags-datasource).
Managers are the Renovate concept for package managers.
There isn’t an AUR or `PKGBUILD` manager, but there is a [regex manager](https://docs.renovatebot.com/modules/manager/regex/) that I can use.

I can create a `renovate.json` configuration with the following custom manager configuration:

```json title="renovate.json"
{
  "customManagers": [
    {
      "customType": "regex",
      "fileMatch": ["(^|/)PKGBUILD$"],
      "matchStrings": [
        "pkgver=(?<currentValue>.*) # renovate: datasource=(?<datasource>.*) depName=(?<depName>.*)"
      ],
      "extractVersionTemplate": "^v?(?<version>.*)$"
    }
  ]
}
```

Breaking that down:

- The `fileMatch` setting tells Renovate to look for any `PKGBUILD` files in a repository
- The `matchStrings` is the regex format to extract the version, datasource, and dependency name from the `PKGBUILD`
- The `extractVersionTemplate` is to handle a “v” in front of any version number that is sometimes added to Git tags

And here’s an extract from the PKGBUILD for the [bicep-bin](https://aur.archlinux.org/packages/bicep-bin) AUR package that I maintain:

```bash
pkgver=0.15.31 # renovate: datasource=github-tags depName=Azure/bicep
```

Here I’m configuring Renovate to use the [`github-tags`](https://docs.renovatebot.com/modules/datasource/github-tags/) datasource and to look in the [`Azure/bicep` GitHub repository](https://github.com/Azure/bicep) for new versions.
That means it’ll look in the [list of tags for the `Azure/bicep` repository](https://github.com/Azure/bicep/tags) for any new versions.
If Renovate finds any new versions, it’ll automatically update the `PKGBUILD` and open a pull request with the updated version.

So I’ve automated the `PKGBUILD` update, but that’s only half of the work.
The checksums and `.SRCINFO` must be updated before pushing to the AUR.
Unfortunately, Renovate can’t do that (yet, see [Renovate issue #16923](https://github.com/renovatebot/renovate/issues/16923)), but GitHub Actions can!

## Updating checksums and `.SRCINFO` with GitHub Actions

Updating the checksums with `updpkgsums` is easy, and generating an updated `.SRCINFO` with `makepkg --printsrcinfo > .SRCINFO` is straightforward too.
But doing that for a whole repository of AUR packages is going to be a little trickier.
So let me build up the GitHub actions workflow step-by-step.

First, I only want to run this workflow on pull requests targeting the `main` branch.

```yaml
on:
  pull_request:
    types:
      - opened
      - synchronize
    branches:
      - main
```

Next, I’m going to need to check out the entire history of the repository, so I can compare the files changed in the latest commit with the Git history.

```yaml
jobs:
  updpkgsums:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@3df4ab11eba7bda6032a0b82a6bb43b11571feac # v4.0.0
        with:
          fetch-depth: 0
          ref: ${{ github.ref }}
```

Getting the package that changed in a pull request requires a little bit of shell magic.

```yaml
- name: Find updated package
  run: |
    #!/usr/bin/env bash
    set -euxo pipefail

    echo "pkgbuild=$(git diff --name-only origin/main origin/${GITHUB_HEAD_REF} "*PKGBUILD" | head -1 | xargs dirname)" >> $GITHUB_ENV
```

Now I’ve found the package that changed in the Renovate pull request, I can update the files.

This step in the workflow uses a private GitHub Action that I have in my `aur-packages` repository.
I’m not going to break it down here, but at its core it runs `updpkgsums` and `makepkg --printsrcinfo > .SRCINFO` with a little extra configuration required to run Arch Linux on GitHub Actions runners.
You can [check out the full code on GitHub](https://github.com/JamieMagee/aur-packages/tree/main/.github/actions/aur).

```yaml
- name: Validate package
  if: ${{ env.pkgbuild != '' }}
  uses: ./.github/actions/aur
  with:
    action: 'updpkgsums'
    pkgname: ${{ env.pkgbuild }}
```

Finally, once the `PKGBUILD` and `.SRCINFO` are updated I need to commit that change back to the pull request.

```yaml
- name: Commit
  if: ${{ env.pkgbuild != '' }}
  uses: stefanzweifel/git-auto-commit-action@3ea6ae190baf489ba007f7c92608f33ce20ef04a # v4.16.0
  with:
    file_pattern: '*/PKGBUILD */.SRCINFO'
```

Check out [this pull request for `bicep-bin`](https://github.com/JamieMagee/aur-packages/pull/62) where Renovate opened a pull request, and my GitHub Actions workflow updated the `b2sums` in the `PKGBUILD` and updated the `.SRCINFO`.

But why stop there?
Let’s talk about publishing.

## Publishing to the AUR

Each AUR package is its own Git repository.
So to update a package in the AUR, I only need to push a new commit with the updated `PKGBUILD` and `.SRCINFO`.
Thankfully, [KSXGitHub](https://github.com/KSXGitHub) created the [`github-actions-deploy-aur` GitHub Action](https://github.com/KSXGitHub/github-actions-deploy-aur) to streamline the whole process.

If I create a new GitHub Actions workflow to publish to the AUR, I can reuse the first two steps from my previous workflow to check out the repository and find the updated package.
Then all I need to do is to use the `github-actions-deploy-aur` GitHub Action:

```yaml
- name: Publish package
  uses: KSXGitHub/github-actions-deploy-aur@065b6056b25bdd43830d5a3f01899d0ff7169819 # v2.6.0
  if: ${{ env.pkgbuild != '' }}
  with:
    pkgname: ${{ env.pkgbuild }}
    pkgbuild: ${{ env.pkgbuild }}/PKGBUILD
    commit_username: ${{ secrets.AUR_USERNAME }}
    commit_email: ${{ secrets.AUR_EMAIL }}
    ssh_private_key: ${{ secrets.AUR_SSH_PRIVATE_KEY }}
```

### All together now

If you own any AUR packages and want to automate some of the maintenance burden, check out [my AUR packages template GitHub repository](https://github.com/JamieMagee/aur-packages-template/).
It contains all of the steps I showed in this blog post.
And if you want to see how it works in practice, check out [my AUR packages GitHub repository](https://github.com/JamieMagee/aur-packages).
