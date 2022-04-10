This package will manage the following parts of the `kustomization.yaml` file:

1. [remote resources](https://github.com/kubernetes-sigs/kustomize/blob/master/examples/remoteBuild.md)
2. [image tags](https://github.com/kubernetes-sigs/kustomize/blob/master/examples/image.md)
3. [components](https://github.com/kubernetes-sigs/kustomize/blob/master/examples/components.md)
4. [helm charts](https://github.com/kubernetes-sigs/kustomize/blob/master/examples/chart.md)
5. [remote bases](https://github.com/kubernetes-sigs/kustomize/blob/master/examples/remoteBuild.md) (deprecated since kustomize v2.1.0)

**How It Works**

1. Renovate will search each repository for any `kustomization.yaml` files.
2. Existing dependencies will be extracted from remote bases, image tags & Helm charts
3. Renovate will resolve the dependency's source repository and check for SemVer tags if found.
4. If an update was found, Renovate will update `kustomization.yaml`

This manager uses three `depType`s to allow a fine-grained control of which dependencies are upgraded:

- Component
- Kustomization
- HelmChart

**Limitations**

- Currently this hasn't been tested using HTTPS to fetch the repos
- The keys for the image tags can be in any order

```yaml
- name: image/name
  newTag: v0.0.1
# or
- newTag: v0.0.1
  name: image/name
```

- Digests can be pinned in `newTag` or `digest`:

```yaml
- name: image/name
  newTag: v0.0.1@sha256:3eeba3e2caa30d2aba0fd78a34c1bbeebaa1b96c7aa3c95ec9bac44163c5ca4f
# without a version, digests are tracked as :latest
- name: image/name
  digest: sha256:3eeba3e2caa30d2aba0fd78a34c1bbeebaa1b96c7aa3c95ec9bac44163c5ca4f
```

- The image's repository can be changed with `newName`:

```yaml
- name: image/name
  newName: custom-image/name:v0.0.1
- name: image/name
  newName: custom-image/name:v0.0.1@sha256:3eeba3e2caa30d2aba0fd78a34c1bbeebaa1b96c7aa3c95ec9bac44163c5ca4f
- name: image/name
  newName: custom-image/name@sha256:3eeba3e2caa30d2aba0fd78a34c1bbeebaa1b96c7aa3c95ec9bac44163c5ca4f
- name: image/name
  newName: custom-image/name
  newTag: v0.0.1@sha256:3eeba3e2caa30d2aba0fd78a34c1bbeebaa1b96c7aa3c95ec9bac44163c5ca4f
- name: image/name
  newName: custom-image/name
  digest: sha256:3eeba3e2caa30d2aba0fd78a34c1bbeebaa1b96c7aa3c95ec9bac44163c5ca4f
```

- Images with values ignored by Kustomize will be skipped to avoid ambiguity:

```yaml
# bad: skipped because newTag: is ignored when digest: is set
- name: image/name
  newTag: v0.0.1
  digest: sha256:3eeba3e2caa30d2aba0fd78a34c1bbeebaa1b96c7aa3c95ec9bac44163c5ca4f
# good:
- name: image/name
  newTag: v0.0.1@sha256:3eeba3e2caa30d2aba0fd78a34c1bbeebaa1b96c7aa3c95ec9bac44163c5ca4f
```
