# packages presets

This directory contains presets for defining lists of packages.

Preset configs here should include only the following fields from `packageRules`: `packageNames`, `packagePatterns`, `excludePackageNames` and `excludePackagePatterns`. Essentially this means they are partial package rules which exist to be extended elsewhere.

They can be referenced using the `packages:` prefix, e.g. `packages:linters`.
