Renovate can manage these parts of the `kustomization.yaml` file:

1. [remote resources](https://github.com/kubernetes-sigs/kustomize/blob/master/examples/remoteBuild.md)
1. [image tags](https://github.com/kubernetes-sigs/kustomize/blob/master/examples/image.md)
1. [components](https://github.com/kubernetes-sigs/kustomize/blob/master/examples/components.md)
1. [helm charts](https://github.com/kubernetes-sigs/kustomize/blob/master/examples/chart.md)
1. [remote bases](https://github.com/kubernetes-sigs/kustomize/blob/master/examples/remoteBuild.md) (deprecated since Kustomize `v2.1.0`)

**How It Works**

1. Renovate searches in each repository for any `kustomization.yaml` files
1. Dependencies are extracted from remote bases, image tags and Helm charts
1. Renovate resolves the dependency's source repository and checks if there are SemVer tags
1. If Renovate finds an update, then it updates the `kustomization.yaml` file

This manager uses three `depType`s to allow fine-grained control of which dependencies are upgraded:

- Component
- Kustomization
- HelmChart
- OCIChart

**Limitations**

- Using HTTPS to fetch the repositories is not tested
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
