# renovate

Keep npm dependencies up-to-date via Pull Requests

## What does it do?

This script scans your repository package.json files, detects if any dependencies need version updating - or pinning - and if so then submits Pull Requests for each.

This was inspired by the services at [Greenkeeper](https://greenkeeper.io) and [Doppins](https://doppins.com).

## Before you Start

To run this script, you will need to select a GitHub user account for it to create branches and submit Pull Requests from. The account will need read/write access to push and update upgrade branches to GitHub, as well as raise Pull Requests.

We recommend you consider using a "bot" account for this so that it's clear to other users of the repository that these are automated actions and not not confused with an actual team member's actions.

The script will need a GitHub Personal Access Token with "repo" permissions. You can find instructions for generating it here: https://help.github.com/articles/creating-an-access-token-for-command-line-use/

This token needs to be exposed via the environment variable `RENOVATE_TOKEN` or added to a configuration file.

## Running the Script

To run the script from the command line, you will need Node.js version 6 or greater.

First, install dependencies for this script by running `npm install`.

 The script can then be run like this:

```sh
npm start <username>/<repo> <path to package.json>
```

The `<path to package.json>` argument is optional, and is only needed if your `package.json` is located somewhere other than the root of the repository.

Example of running with default `package.json` location:

```sh
npm start foo/bar
```

Example of running with a custom `package.json` location:

```sh
npm start foo/bar src/package.json
```

Note: as mentioned above, you need to expose the environment variable `RENOVATE_TOKEN`. One way of doing it is like this:

```sh
RENOVATE_TOKEN=JDSUW284HSJDSFKSUS22942H2H15KK npm start foo/bar
```

## Configuration file

It's also possible to configure renovate with a `config.js` file in the working directory. Here is an example:

```js
module.exports = {
  token: 'JDSUW284HSJDSFKSUS22942H2H15KK',
  logLevel: 'verbose',
  repositories: [
    'foo/bar',
    'foo/baz',
    {
      name: 'foo/lint',
      packageFiles: [
        'package.json',
        'containers/build/package.json',
      ],
    },
    'foo/package-go',
  ],
};
```

As you can hopefully infer from the above, it's possible to define multiple repositories as well as multiple package files per repository, and they will be processed in sequence.

If you configure the token and at least one repository in your `config.js` then you don't need any CLI arguments and can just run `npm start`.

It's also possible to change the string templates used for generating branch names, commit messages, and Pull Request titles and body. To override the defaults, copy/paste/edit the templates from `app/config/defaults.js` into your `config.js`. You must copy all of them, even if you only edit one.
