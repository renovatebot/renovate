# Renovate Hands-on-tutorial

## Introduction

We will learn how to run renovate and experience how it works.
There are Multiple ways to run Renovate, using CLI, self-hosted server or docker,
but the easiest way to start with is the [Renovate App](https://github.com/apps/renovate).

You can trigger renovate manually from CLI or docker by running it to pick up any changes needed,
or you can run [Renovate App](https://github.com/apps/renovate) or a host renovate on a server,
and it will pick up any needed changes every few minutes/hours.

## Tutorial

- We will work with Github for this tutorial since our app is hosted on Github, open your Github repository
- Fork [this](https://github.com/PhilipAbed/RenovateTutorial) repository
- Make sure `issues` are enabled on github, `settings` ->`general` -> check the `issues` checkbox.
- Install renovate app, go to [Renovate App](https://github.com/apps/renovate), and install it, it will take you to a page where you can select on which repositories you want to run renovate on
- Select the forked repository, you can configure that at anytime by going again to [Renovate App](https://github.com/apps/renovate) and pressing the `Configure` button.
- After installing the app, it will run in the background and trigger on the selected repositories and create an on-boarding PR, Which will add a `renovate.json` configuration file.
- make sure you read the on-boarding PR, then go ahead and merge the on-boarding pull request.
- if you go to the [dashboard](https://app.renovatebot.com/dashboard), you will see when renovate runs.
- Once you merge, renovate will trigger again automatically, and you will notice that it scanned the `package.json` and opened some pull requests.
- renovate by default will try to get the latest version, but you can restrict updates to a certain version using `allowedVersions`

### Allow specific versions

- Go to your `renovate.json` file and edit it, then change its contents to the below and commit it

  ```
  {
    "extends": [
      "config:base"
    ],
    "packageRules": [
      {
        "matchPackageNames": [
          "lodash"
        ],
        "allowedVersions": "<= 4.17.21"
      },
      {
        "matchPackageNames": [
          "commander"
        ],
        "allowedVersions": "<= 9.0.0"
      }
    ]
  }
  ```

- if you take a look now at the 2 PRs they will have the constraints on the version, as we mentioned in the configuration file `Package Rules`
- if you look at the 2 PRs and look at the Merge Confidence, you will notice one of them is Highly recommended with high merge confidence but the other one is low merge confidence

### Dashboard approval

- Add this `PackageRule` to the `renovate.json`.

  ```
   {
     "matchUpdateTypes": [
       "major"
     ],
     "matchManagers": [
       "npm"
     ],
     "dependencyDashboardApproval": true
   }
  ```

- we added `matchUpdateTypes=Major` and `matchManagers=npm` and `dependencyDashboard=approval`
  that means that branches will be created for Major version change only after approval, lets try that,
  add these outdated major version dependency updates to the `dependencies` section in the `package.json`

  ```
  "graceful-fs": "3.0.12",
  "ansi-regex": "4.1.0",
  ```

- Wait a few seconds/minutes until renovate runs again and picks the new dependencies up, it will trigger after a change to the `package.json`
- Now you will notice that nothing changed, but if you go to `issues` and press on the Dependency Dashboard
  you can see that there is a section with `Pending Approval`, for `ansi-regex` and `graceful-fs` major version update

### Rate limit

- You can see also the `Rate Limited` ansi-regex minor version update, since renovate by default `config:base` doesn't open more than 2 PRs every hour,
  and we already have 2 open PRs, that way you can reduce noise
- if you want to force open more PRs you can click the checkbox next to the PR you want to open, and it will force open a PR for the checked issue on the next trigger/hook.
- or you can look into the [Docs](https://docs.renovatebot.com/configuration-options/#prconcurrentlimit)
- you can also ignore the hourly limit preset

  ```
  {
    "extends": ["config:base"],
    "ignorePresets": [":prHourlyLimit2"]
  }
  ```

### Grouping

- You can group dependencies into a certain group, for example, lets add these dependencies to the `dependencies` section in the `package.json`

  ```
   "@mue-js/sass": "1.0.7",
   "@mue-js/react": "1.1.0",
   "@mue-js/icons": "1.0.3",
  ```

  renovate might trigger and run, these dependencies will probably show in your `issues` -> `dependency dashboard`
  then add to the configuration file `renovate.json` this packageRule

  ```
  {
    "matchPackagePatterns": ["@mue"],
    "groupName": "muePkgs"
  }
  ```

  that will look for every dependency that has the pattern `@mue` and add it to a group name called `muePkgs`

- wait a few seconds until renovate triggers again and then look at your dependency dashboard,
  you will notice that every dependency that includes the keyword `@mue` is in the same Issue in the dashboard!

### Auto merge

- Add this package rule for scheduling auto-merge,

  ```
   {
     "matchPackagePatterns": ["mue"],
     "schedule": ["at any time"],
     "automerge": true,
     "matchUpdateTypes": ["minor", "patch"]
   }
  ```

- You can read about the parameters in the configuration documentation, but I will summarize it for you,
  I'm Matching any package that has the pattern `mue`, and I put my schedule for auto-merge `at any time`,
  then I set `automerge=true` to activate it, then I want to auto-merge only `minor and patch` version upgrades,
- Since renovate by our default configuration has noise reduction, it doesn't create more than 2 PRs every hour, so lets Force a PR to auto merge it,
  press the checkbox in the `issues` -> `Dependency Dashboard`
- [x] <!-- unlimit-branch=renovate/muepkgs -->Update muePkgs (`@mue-js/icons`, `@mue-js/react`, `@mue-js/sass`)
- Renovate will open a PR with the 3 grouped dependencies, if they match the the auto-merge rule, and the schedule,
  and the PR status is Green, then it's waiting to be auto-merged
- Now go to the [Dashboard](https://app.renovatebot.com/dashboard) and wait until renovate runs again, takes some time.
