# renovate

Keep npm dependencies up-to-date.

## Before you Start

To run this script, you will need to select a GitHub account for it to use. The account will need read/write access to push and update upgrade branches to GitHub, as well as raise Pull Requests.

We recommend using a "bot" account so that it's clear to other users of the repository that these are automated actions and not a team member performing them all manually.

The script will need a GitHub "access token" for authenticating API access. You can find instructions for generating it here: https://help.github.com/articles/creating-an-access-token-for-command-line-use/

This token needs to be exposed via the environment variable `RENOVATE_TOKEN`.

## Running the Script

To run the script from the command line, you will need Node.js version 6 or greater.

First, install dependencies for this script by running `npm install`.

 The script can then be run like this:

```sh
node src <username>/<repo> <path to package.json>
```

The `<path to package.json>` argument is optional, and is only needed if your `package.json` is located somewhere other than the root of the repository.

Example of running with default `package.json` location:

```sh
node src singapore/renovate
```

Example of running with a custom `package.json` location:

```sh
node src JDSUW284HSJDSFKSUS22942H2H15KK singapore/renovate containers/build/package.json
```

Note: as mentioned above, you need to expose the environment variable `RENOVATE_TOKEN`. One way of doing it is like this:

```sh
RENOVATE_TOKEN=JDSUW284HSJDSFKSUS22942H2H15KK node src singpaore/renovate
```
