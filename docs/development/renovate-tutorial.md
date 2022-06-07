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
- Once you merge, renovate will trigger again automatically and you will notice that it scanned the package.json and opened some pull requests.
- go to your `repository/renovate.json` file and edit it, then change its contents to the below and commit it

```
{
  "extends": [
    "github>whitesource/merge-confidence:beta"
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
      "matchUpdateTypes": [
        "major"
      ],
      "matchManagers": [
        "npm"
      ],
      "dependencyDashboardApproval": true
    }
  ]
}

```

- Note: you can extend config based on your needs, u can start from scratch by extending `"config:base"`
  but we would like to show you the merge confidence feature so we extended `"github>whitesource/merge-confidence:beta"`
- Now take a look in the `packageRules` section we added matchUpdateTypes=Major and matchManagers=npm and dependencyDashboard=approval
