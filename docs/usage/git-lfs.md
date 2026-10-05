---
title: Git LFS
description: How Renovate commits and reads files that are stored in Git LFS
---

# Git LFS

Renovate can update repositories that store some files in [Git LFS](https://git-lfs.com/).
This support is experimental, and off by default.
A Renovate administrator turns it on with the self-hosted [`gitLfs`](./self-hosted-configuration.md#gitlfs) option.

## How it works

When `gitLfs` is `upload` or `enabled`, Renovate:

1. Clones the repository with the LFS filters in "skip" mode, so LFS-tracked files are LFS pointers, and no LFS content is downloaded
1. With `gitLfs=enabled`, after it reads the repository config, downloads the LFS-tracked files that match [`gitLfsInclude`](./configuration-options.md#gitlfsinclude) once, and keeps them real on every later checkout
1. Commits LFS-tracked files that it or a tool changed as LFS pointers, like `git add` does on a developer's machine
1. Uploads exactly the LFS objects that its new commit added, with `git lfs push --object-id`, without running Git hooks
1. Pushes the commit as usual, by default with `git push --no-verify`

Renovate never runs `git lfs install`, never installs Git hooks, and never writes the LFS filters or the LFS endpoint to the repository's `.git/config`.

Renovate uploads the LFS objects before it creates the commit on the platform, so this should also work with [`platformCommit`](./configuration-options.md#platformcommit), for example when Renovate runs as a GitHub App.
This has not been verified end-to-end yet.

If an LFS-tracked file is not included, Renovate reads its LFS pointer instead of its content.
Renovate logs a warning when that happens.

## Examples

### Files written by `postUpgradeTasks`

Say a `postUpgradeTasks` command downloads a release tarball into a path that is tracked by Git LFS.
Renovate commits the tarball as an LFS pointer and uploads it.
Renovate does not need to download any LFS content for this, so `gitLfs: "upload"` is enough, and you don't need `gitLfsInclude`.

```js title="Self-hosted config"
module.exports = {
  gitLfs: 'upload',
};
```

### LFS-tracked lock files

If your repository stores `package-lock.json` in Git LFS, Renovate must read the real lock file to update it.
The administrator sets `gitLfs` to `enabled`, and the repository config lists the lock files:

```json title="Repository config"
{
  "gitLfsInclude": ["package-lock.json", "**/package-lock.json"]
}
```

### Yarn zero-installs

If your repository stores the Yarn cache in Git LFS, include the cache, so Yarn can use it:

```json title="Repository config"
{
  "gitLfsInclude": [".yarn/cache/**"]
}
```

### GitHub App

With `platformCommit`, Renovate creates the commit with the GitHub API.
Git LFS works the same way, because Renovate uploads the LFS objects before it creates the commit, and the API commit reuses the LFS pointer files.
Use `upload` or `enabled` as in the examples above.

## Platform notes

Renovate uploads and downloads LFS content with the same credentials it uses to clone the repository.
Renovate pins the Git LFS API endpoint to the repository's own remote URL, with the remote URL's credentials.
The LFS server can still send the actual object transfers to another host, for example GitHub's LFS storage.
If the clone authentication is a Git `http.extraHeader`, Git LFS may also send that header to those hosts.

Git LFS support is experimental.
It has been verified end-to-end on github.com, with both `git push` and `platformCommit`.
It should work on other platforms that serve Git LFS from the repository's own URL, but this has not been verified yet.
Please share your results in [issue #6842](https://github.com/renovatebot/renovate/issues/6842).

Uploads and downloads count against the repository owner's LFS storage and bandwidth quota.

## Troubleshooting

| Message                                                                                               | Cause and fix                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Init: gitLfs="..." requires git-lfs >= ... on PATH`                                                  | Install a newer `git-lfs` binary, do not run `git lfs install`.                                                                                           |
| `Git LFS support is not available for SSH remotes yet`                                                | Renovate commits LFS-tracked files as regular Git files. Use an HTTPS remote.                                                                             |
| `Git LFS support is not available in fork mode`                                                       | Git LFS is not supported with `forkToken` yet.                                                                                                            |
| `Git LFS support is inactive for this repository because .lfsconfig points to a different LFS server` | Renovate only uploads to the repository's own LFS storage. Remove the `url` or `pushurl` from `.lfsconfig`, or don't use Renovate on that repository yet. |
| `Ignoring GIT_CONFIG_* from repository env because gitLfs is enabled`                                 | Remove `GIT_CONFIG_*` variables from the repository `env` config.                                                                                         |
| `gitLfsInclude is ignored because gitLfs is set to "upload"`                                          | Ask your Renovate administrator to set `gitLfs` to `enabled`, or remove `gitLfsInclude`.                                                                  |
| `Renovate could not download Git LFS content for paths matching gitLfsInclude`                        | An LFS object is missing on the server, or the server is unavailable. Upload the missing object, or narrow `gitLfsInclude`.                               |
| `File is stored in Git LFS and Renovate read its LFS pointer instead of the content`                  | Add the file to `gitLfsInclude`, or ask your administrator to set `gitLfs`.                                                                               |
| `Renovate config file is stored in Git LFS`                                                           | Store the Renovate config file as a regular Git file.                                                                                                     |
| `The push was rejected because it references Git LFS objects that are not on the server (GH008)`      | Ask your Renovate administrator to set `gitLfs`.                                                                                                          |
| `The push was rejected (GH008) although Renovate uploaded its Git LFS objects`                        | Check that Git LFS is enabled for the repository, and that its LFS storage quota is not exhausted.                                                        |

Large LFS uploads or downloads that print no output for longer than the self-hosted [`gitTimeout`](./self-hosted-configuration.md#gittimeout) can be stopped.
Raise `gitTimeout` if that happens.

## Limitations

- SSH remotes are not supported yet, Git LFS stays inactive for them
- Fork mode (`forkToken`) is not supported yet
- LFS servers other than the repository's own, for example set in `.lfsconfig`, are not supported
- Git LFS inside Git submodules is not supported
- Renovate does not take or check LFS locks
- Git commands that you run inside `postUpgradeTasks` do not get Renovate's Git LFS config
- `gitLfsInclude` patterns use the `git-lfs` syntax, not Renovate's string pattern matching
- There is no limit for the amount of LFS content Renovate downloads, use `gitLfs: "upload"` if you need zero downloads
- When `gitLfs` is set, Renovate's own Git commands don't run the repository's Git hooks, even with `gitNoVerify: []`
- Git LFS support is not tested on Windows
