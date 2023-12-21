This datasource will default to using the `GOPROXY` settings `https://proxy.golang.org,direct` if there is no value defined in environment variables.

To override this default and use a different proxy, simply configure `GOPROXY` to an alternative setting in env.

To override this default and stop using any proxy at all, set `GOPROXY` to the value `direct`.

It is possible to use a customPackageNameRegistryUrlSplitter which splits a typicall go modul into an url and a package name for gitlab.

e.g. example.com/gitlab/my-repo.git

customPackageNameRegistryUrlSplitter: "(example.com/gitlab/)(.*).git"

registryUrl: example.com/gitlab/
packageName: my-repo

```
...
    {
      "matchHost": "example.com/gitlab",
      "customPackageNameRegistryUrlSplitter": "(example.com/gitlab/)(.*).git",
      "token": process.env.RENOVATE_TOKEN
    },
...
```
