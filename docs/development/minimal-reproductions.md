# About minimal reproductions

To help the Renovate team debug, you may be asked to provide a "minimal reproduction" repository.

This document explains why we need a minimal reproduction, why we're not using your production repository to debug, and how you can create a good minimal reproduction.

## What is a minimal reproduction?

The basic idea of a minimal reproductions is to use the least amount of code/config to trigger the bug.
Having a minimal reproduction makes it easier for the developers to see where the bug is, and to verify that the new code fixes the bug.

### Why not use the production repository to debug?

You might think, why is a minimal reproduction even needed?
I already have the reproduction on my production repository.
Why not use that to debug?

A production repository uses many dependencies, and can have a large list of custom rules in the Renovate configuration file. This makes it very hard to debug the repository, because there are many moving parts.

Also, sometimes in a production repository, the bug is not caused by what you think is causing the bug.

Unless it's a very simple bug, the Renovate team cannot fix the bug, and verify the bugfix, without a lightweight reproduction repo.

## Why we require a minimal reproduction

To help us with debugging, we insist that you create a minimal reproduction repository.
This repository must be hosted on GitHub/GitLab/Bitbucket, and must be publicly acessible.

### Making a reproduction repository is too much work for me

We know that making the minimal reproduction can be a lot of work, and that it can be hard to figure out what parts are needed to trigger the bug.

If you do not want to do the work to make the reproduction, how can you expect the Renovate team to invest time in fixing your bug?
No reproduction, no bug fix.

## How to create a good minimal reproduction

For Renovate bugs, the minimal reproduction is:

- A fork/copy of the repository where the bug occurs
- This fork/copy is stripped of all unnecessary files/rules/configuration

A good minimal reproduction:

- Uses the fewest amount of dependencies possible to trigger the bug
- Uses only the Renovate configuration rules that are relevant to the bug report
- Only has the minimal files needed to trigger the bug
