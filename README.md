# renovate

Keeping npm dependencies up-to-date.

## Before you Start

To run this script, you will need to select a GitHub account for it to use. The account will need read/write access to push and update upgrade branches to GitHub, as well as raise Pull Requests.

We recommend to use a named "bot" account so that it's clear to other users of the repository that these are automated actions and not a team member performing them all manually.

### GitHub SSH access for git

This script performs git clones, branching and pushing of branches to GitHub using SSH-based authentication. The public key (`~/.ssh/id_rsa.pub`) of wherever you're running the script needs to be manually added to GitHub before the first time you run the script. You can find instructions here: https://help.github.com/articles/adding-a-new-ssh-key-to-your-github-account/

### Personal Access Token for GitHub API access

The script will also need a GitHub "access token" for authenticating API access. You can find instructions for generating it here: https://help.github.com/articles/creating-an-access-token-for-command-line-use/

## Running the Script

To run the script from the command line, you will need Node.js version 6 or greater.

First, install dependencies for this script by running `npm install`.

 The script can then be run like this:

```sh
node src/index.js <github token> <username>/<repo> <path to package.json>
```

The `<path to package.json>` argument is optional, and is only needed if your `package.json` is located somewhere other than the root of the repository.

Example of running with default `package.json` location:

```sh
node src/index.js JDSUW284HSJDSFKSUS22942H2H15KK singapore/renovate
```

Example of running with a custom `package.json` location:

```sh
node src/index.js JDSUW284HSJDSFKSUS22942H2H15KK singapore/renovate containers/build/package.json
```
