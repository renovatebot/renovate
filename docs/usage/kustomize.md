---
title: Kustomize
description: Kustomize support in Renovate
---

# Automated Dependency Updates for Kustomize files

Renovate supports upgrading dependencies in `kustomization.yaml` files.

## How It Works

1.  Renovate will search each repository for any `kustomization.yaml` files.
2.  Existing dependencies will be extracted from remote bases & image tags
3.  Renovate will resolve the dependency's source repository and check for semver tags if found.
4.  If an update was found, Renovate will update `kustomization.yaml`

## Limitations

- Currently this hasn't been tested using https to fetch the repos
- the image tags are limited to the following formats:

```
- name: image/name
  newTag: v0.0.1
```

or

```
- newTag: v0.0.1
  name: image/name
```
