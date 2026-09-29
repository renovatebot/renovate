# Community Tools

This page lists community-maintained tools that extend or complement Renovate.
These tools are not officially supported by the Renovate team, but may be useful for your workflow.

!!! note
  If you have a community tool you'd like to add to this page, please open a pull request.

## Renovate Operator (Kubernetes)

The [Renovate Operator](https://github.com/mogenius/renovate-operator) lets you run Renovate on Kubernetes in a native way.
It wraps the Renovate CLI in a Kubernetes operator and adds features like:

- CRD-based scheduling with declarative cron syntax
- Parallel execution with configurable concurrency control
- Auto-discovery of repositories
- Built-in web dashboard for monitoring and management
- Webhook API for on-demand runs
- Prometheus metrics and health checks

## `renovate-pretty-log`

[`renovate-pretty-log`](https://gitlab.com/tanna.dev/renovate-pretty-log/) is a set of utilities to provide a richer, local-only view, for your Renovate debug logs.

The project is maintained by Renovate maintainer Jamie Tanna.

### `renovate-pretty-log-tui`

`renovate-pretty-log-tui` is a Terminal User Interface (TUI) to provide a richer, local-only view, for your Renovate debug logs.

[![asciicast showing an interactive session with a multi-repository Renovate run, with a split pane showing the log lines themselves, and a separate pane to view additional log context. There is also a summary view which shows high-level information about the repository](https://asciinema.org/a/1263327.svg)](https://asciinema.org/a/1263327)

It also provides more advanced searching and filtering:

[![asciicast showing how to search and filter the logs in a given Renovate run](https://asciinema.org/a/0Qx5XsfhkO9JJURV.svg)](https://asciinema.org/a/0Qx5XsfhkO9JJURV)

And can be used to surface issues in repository runs more visually:

[![asciicast showing the investigation of a Renovate run that has ended with a `config-validation` error](https://asciinema.org/a/FsGapARB27c44XRn.svg)](https://asciinema.org/a/FsGapARB27c44XRn)

### HTML exports

There are some additional utilities in the project, including the ability to generate a single-page HTML view of the logs:

```sh
renovate-pretty-log -path /path/to/debug.log -html > report.html
```

You can see [a live example of what this looks like from one of Renovate's own runs](https://www.jvt.me/casts/2026-08-renovate-pretty-log/renovate-debug-out.html).

## Renovate Config Debugger

The [Renovate Config Debugger](https://renovate.secustor.dev/) shows what Renovate does with a config before you commit it.
It runs Renovate's own code in the browser, so the config never leaves the page.

![Renovate Config Debugger simulating a minor update of @aws-sdk/client-s3 and showing which packageRules set groupName](assets/images/renovate-config-debugger.jpg)

- Runs the full config pipeline, parsing, migration, validation and preset resolution, and shows the intermediate result of each stage
- Expands `extends` into the full preset tree
- Shows per-option provenance: which default, preset or config layer set a value
- Simulates a hypothetical update and shows which `packageRules` match and why
- Loads a repository and runs Renovate's managers over its package files to list the extracted dependencies
- Is also available as a [CLI, MCP server and Docker image](https://github.com/secustor/renovate-config-debugger) for self-hosting

The project is maintained by Renovate maintainer Sebastian Poxhofer ( @secustor ).
The blog post [Renovate: It was a packageRule all along](https://secustor.dev/blog/renovate_config_debugger/) walks through debugging a config with it.
