# Troubleshooting Renovate

Learn how to troubleshoot problems with Renovate, where to find the logging output, and how to get help if needed.

## Getting the logs

Renovate's debug-level logs are usually enough to help troubleshoot most problems.
Where you can find the logs depends on how you're running Renovate.

### The Mend Renovate App

Each pull request from the Mend Renovate App has a link to the [Mend Developer Portal](https://developer.mend.io/) in the PR body text.

The text you're looking for is:

> This PR has been generated by Mend Renovate. View repository job log here.

Select the blue text "here" to go to the Recent jobs page in the [Mend Developer Portal](https://developer.mend.io/).
Sign in with your GitHub account.
Once you're logged in, you can see the logs for the Renovate jobs on your repository.
You should have access to any repository which you have write access to and which has Renovate installed.

Renovate only provides the 10 most recent logs for each repository.

After selecting a recent job, you can select the debug level that you care about.
For a full overview, select the `DEBUG` log level.

### Self-hosted

The easiest way to gather logs from Renovate for any platform is to use the default logging to `stdout`/console.
By default, Renovate will log in a human-readable format at `INFO` level.

For troubleshooting it's recommended to increase logging to `DEBUG` level by adding `LOG_LEVEL=debug` to your environment variables before invoking Renovate.

If your Renovate logs are being processed by a log service before you access them, you may find it better to have Renovate output logs in JSON format instead so that they can be reliably parsed and filtered.
This can be achieved by adding `LOG_FORMAT=json` to your environment variables before invoking Renovate.

## Log debug levels

There are different severity levels for the log output.
From least severe to most severe:

- `DEBUG`
- `INFO`
- `WARN`
- `ERROR`
- `FATAL`

To check for problems, look for `WARN` or `ERROR` logs (level 40 or 50 if in JSON format).
To troubleshoot further, you usually need to look at `DEBUG` logs.

## Resolving problems using logs

We recommend you follow this process:

1. Try to narrow in on the problem area e.g. by looking for relevant branches or `WARN` or `ERROR` messages
1. Find all relevant `DEBUG` or `INFO` messages from before and after the problem occurred
1. Copy/paste the relevant parts of the logs into your discussion post or bug report

If you cannot fix the problem yourself after reading the logs, and reading - or searching through - our documentation, search the [`renovatebot/renovate` discussion](https://github.com/renovatebot/renovate/discussions) forum to see if somebody has asked a similar or related question.

If none of these steps have helped you, then create a new discussion post to get help from the Renovate maintainers.

Please locate the relevant parts of the logs as described earlier before asking for help or posting a bug report.
Do not expect the Renovate maintainers to read through the full logs when trying to help you, as that takes a lot of time on our part.
If later it turns out that the full logs are necessary, you will be asked for them then.

## Validating configuration changes

Sometimes you will have to change your Renovate configuration to solve a problem.
The [`renovate-config-validator` program](config-validation.md) helps validate such configuration changes without committing them to your repository.