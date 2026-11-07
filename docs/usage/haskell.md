---
title: Haskell
description: Haskell support in Renovate
---

# Automated Dependency Updates for Haskell

Renovate supports updating Haskell dependencies with these managers:

- [`haskell-cabal`](./modules/manager/haskell-cabal/index.md) updates `build-depends` version ranges in `.cabal` files, using versions from Hackage
- [`haskell-stack`](./modules/manager/haskell-stack/index.md) updates the commits of Git `extra-deps` in `stack.yaml` files

Both managers are enabled by default.
Read the documentation of each manager to learn about its limitations.
