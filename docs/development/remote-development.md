# Remote Development

This document gives tips and tricks on how to run Renovate in a remote container to add features or fix bugs.
You can improve this documentation by opening a pull request.
For example, if you think anything is unclear, or you think something needs to be added, open a pull request!

## First read the local development docs

Read the [local development docs](./local-development.md) first.

## What's remote development?

When you work locally, you install the tooling and code editor on your computer.
You are responsible for setting up the environment correctly.

With remote development you use a container that's hosted somewhere else.
You'll use the same code editor and have the same config as all other developers.

### Benefits

- You only need a browser and internet
- You don't need to install development dependencies on your computer
- Start work in a fresh environment every time
- Reproducible development environment
- Similar config for all developers
- Use VS Code in the browser

### Drawbacks

- Waiting for the remote container to start
- If your internet is down or Gitpod or GitHub Codespaces are down then you can't work

## Gitpod

You can use [Gitpod](https://gitpod.io/) for light development work like:

- Editing the docs
- Running ESLint, Prettier

For proper development, use GitHub Codespaces.

The config file for Gitpod is `.gitpod.yml` in the root of the repository.

Gitpod comes with 50 free hours each month.
If you need more hours you'll need to buy a plan with more hours.

### Gitpod tips

- Use `yarn jest` to run the tests on Gitpod

### Known problems with Gitpod

There are two failing tests when running `yarn jest` on Gitpod:

```bash
Summary of all failing tests
 FAIL  lib/util/git/index.spec.ts (635.102 s, 319 MB heap size)
  ● util/git/index › isBranchModified() › should return false when author matches

    expected true to be false or Boolean(false)

      283 |
      284 |     it('should return false when author matches', async () => {
    > 285 |       expect(await git.isBranchModified('renovate/future_branch')).toBeFalse();
          |                                                                    ^
      286 |       expect(await git.isBranchModified('renovate/future_branch')).toBeFalse();
      287 |     });
      288 |

      at Object.<anonymous> (lib/util/git/index.spec.ts:285:68)

  ● util/git/index › isBranchModified() › should return false when author is ignored

    expected true to be false or Boolean(false)

      291 |         gitIgnoredAuthors: ['custom@example.com'],
      292 |       });
    > 293 |       expect(await git.isBranchModified('renovate/custom_author')).toBeFalse();
          |                                                                    ^
      294 |     });
      295 |
      296 |     it('should return true when custom author is unknown', async () => {

      at Object.<anonymous> (lib/util/git/index.spec.ts:293:68)

 FAIL  test/static-files.spec.ts (14.506 s, 288 MB heap size)
  ● static-files › has same static files in lib and dist

    thrown: "Exceeded timeout of 10000 ms for a test.
    Use jest.setTimeout(newTimeout) to increase the timeout value, if this is a long-running test."

      36 |   jest.setTimeout(10 * 1000);
      37 |
    > 38 |   it('has same static files in lib and dist', async () => {
         |   ^
      39 |     expect(await getFiles('dist')).toEqual(await getFiles('lib'));
      40 |   });
      41 | });

      at test/static-files.spec.ts:38:3
      at Object.<anonymous> (test/static-files.spec.ts:34:1)
```

## GitHub Codespaces

The Renovate developers use [GitHub Codespaces](https://github.com/features/codespaces).
The config files are in the `.devcontainer` folder in the repository.

You can only use GitHub Codespaces if you're invited into the beta by GitHub.
