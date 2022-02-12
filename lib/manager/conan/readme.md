<!-- prettier-ignore -->
!!! warning
    The Conan package manager is disabled by default due to slowness in the Conan API.
    We recommend you only enable it for low volume experimental purposes until [issue #14170](https://github.com/renovatebot/renovate/issues/14170) is resolved.

Renovate can upgrade dependencies in `conanfile.txt` or `conanfile.py` files.

How it works:

1. Renovate searches in each repository for any `conanfile.txt` or `conanfile.py` file
1. Renovate extracts existing dependencies from:
   - the `[requires]` and `[build_requires]` sections in the `conanfile.txt` format
   - the `requirements()` and `build_requirements()` functions in the `conanfile.py` format
   - and the `python_requires`, `requires` and `build_requires` variables in the `conanfile.py` format
1. Renovate resolves the dependency's version using the Conan v2 API
1. If Renovate finds an update, Renovate will update `conanfile.txt` or `conanfile.py`

Enabling Conan updating

Renovate updates Conan packages by default.
