By default [Hermit](https://cashapp.github.io/hermit/) looks up packages from the open source project [https://github.com/cashapp/hermit-packages](https://github.com/cashapp/hermit-packages).

Hermit supports [private packages](https://cashapp.github.io/hermit/packaging/private/).
To get Renovate to find your private packages, follow these steps:

1. perform `hermit search --json` with your private Hermit distribution and save the file to `index.json`
1. make a GitHub release in your private packages repository named `index` with the asset `index.json` generated in step 1.
1. setup a CI pipeline to repeat step 1 & 2 on new commits to the private packages repository.

Once setup, add a package rule to tell Hermit datasource to fetches packages from in the repository config like the following.

```
"packageRules": [
    {
      "matchManagers": ["hermit"],
      "defaultRegistryUrls": ["https://github.com/your/private-hermit-packages"]
    }
]
```
