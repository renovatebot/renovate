Supports updating git `extra-deps` in [Haskell Stack](https://docs.haskellstack.org/) `stack.yaml` files, including variants such as `stack-ghc-9.6.yaml`.

### Commits

Git packages declared with `git:` or `github:` and a full `commit:` SHA are updated to the latest commit on the default branch of the repository.
`stack.yaml` does not record which branch a commit came from, so a commit pinned from another branch or a fork is also proposed for an update to the default branch.
Disable updates for such packages with a package rule that matches their repository path:

```json
{
  "packageRules": [
    {
      "matchManagers": ["haskell-stack"],
      "matchDepNames": ["org/repo"],
      "enabled": false
    }
  ]
}
```

Dependencies declared in `.cabal` files are handled by the [`haskell-cabal`](../haskell-cabal/index.md) manager.

### Limitations

- Hackage (for example `acme-missiles-0.3`), local path, Mercurial (`hg:`) and archive (`url:`) `extra-deps` are listed but not updated
- Git packages whose `commit` is not a full commit SHA are skipped
- The `resolver`/`snapshot` field is not checked for newer Stackage snapshots
- `stack.yaml.lock` is not updated; Stack regenerates it on the next build
- `package.yaml` is not supported
