# Renovate Hands-on-tutorial

##Introduction
We will learn how to run renovate and experience how it works.
There are Multiple ways to run Renovate, using CLI, self-hosted server or docker,
but the easiest way to start with is the [Renovate App](https://github.com/apps/renovate).

You can trigger renovate manually from CLI or docker by running it to pick up any changes needed,
or you can run [Renovate App](https://github.com/apps/renovate) or a host renovate on a server,
and it will pick up any needed changes every few minutes.

## Steps

- We will work with Github for this tutorial, open your Github repository
- Fork [this](https://github.com/PhilipAbed/RenovateTutorial) repository
- Make sure `issues` are enabled on github, `settings` ->`general` -> check the `issues` checkbox.
- Install renovate app, go to [Renovate App](https://github.com/apps/renovate), and install it, it will take you to a page where you can select on which repositories you want to run renovate
- Select the forked repository, you can configure that anytime by going again to [Renovate App](https://github.com/apps/renovate) and pressing `Configure` button.
- After installing the app, it will run in the background and trigger on the selected repositories and create an on-boarding PR, Which will add a `renovate.json` configuration file.
- make sure you read the on-boarding PR, then go ahead and merge the on-boarding pull request.
- if you go to the [dashboard](https://app.renovatebot.com/dashboard), you will see when renovate runs.
- Once you merge, renovate will trigger again automatically, and you will notice that it scanned the `package.json` and opened some pull requests.
- renovate by default will try to get the latest version, but you can restrict updates to a certain version using `allowedVersions`
- go to your `renovate.json` file and edit it, then change its contents to the below and commit it

  ```
  {
    "extends": [
      "config:base"
    ],
    "prConcurrentLimit": 2,
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
      },
      {
        "matchUpdateTypes": [
          "major"
        ],
        "matchManagers": [
          "npm"
        ],
        "dependencyDashboardApproval": true`
      }
    ]
  }
  ```

- if you take a look now at the 2 PRs they will have the constraints on the version, as we mentioned in the configuration file `Package Rules`
- if you look at the 2 PRs and look at the Merge Confidence, you will notice one of them is Highly recommended with high merge confidence but the other one is low merge confidence
- Take a look in the `packageRules` section we added `matchUpdateTypes=Major` and `matchManagers=npm` and `dependencyDashboard=approval`
  that means that branches will be created for Major version change only after approval, lets try that,
  add these outdated major version dependencies to the `dependencies` section in the `package.json`
  ```
  "graceful-fs": "3.0.12",
  "ansi-regex": "4.1.0",
  ```
- wait a few seconds/minutes until renovate runs again and picks the new dependencies up, it will trigger after a change to the `package.json`
- Now you will notice that nothing changed, but if you go to `issues` and press on the Dependency Dashboard
  you can see that there is a section with `Pending Approval`, for `ansi-regex` and `graceful-fs` major version update
- you can see also the `Rate Limited` ansi-regex minor version update, since we have `prConcurrentLimit=2` and we already have 2 open PRs,
  that way you can reduce noise
-
