This package will manage two parts of the `kustomization.yaml` file:

1. [remote bases](https://github.com/kubernetes-sigs/kustomize/blob/master/examples/remoteBuild.md)
2. [image tags](https://github.com/kubernetes-sigs/kustomize/blob/master/examples/image.md)

**How It Works**

1. Renovate will search each repository for any `kustomization.yaml` files.
2. Existing dependencies will be extracted from remote bases & image tags
3. Renovate will resolve the dependency's source repository and check for SemVer tags if found.
4. If an update was found, Renovate will update `kustomization.yaml`

**Limitations**

- Needs to have `kind: Kustomization` defined
- Currently this hasn't been tested using HTTPS to fetch the repos
- The image tags are limited to the following formats:

```
- name: image/name
  newTag: v0.0.1
```

or

```
- newTag: v0.0.1
  name: image/name
```
