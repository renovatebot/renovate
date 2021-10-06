---
title: Conan
description: Conan support in Renovate
---

# Automated dependency updates for Conan

Renovate supports upgrading dependencies in `conanfile.txt` files.

## How it works

1. Renovate searches in each repository for any `conanfile.txt` or `conanfile.py` file
1. Renovate extracts existing dependencies for `requires`, `build-requires`, or `python-requires`
1. Renovate resolves the dependency's version using the Conan v2 API
1. If Renovate finds an update, Renovate will update `conanfile.txt` or `conanfile.py`

## Enabling Conan updating

Renovate updates Conan packages by default.
