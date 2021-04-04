---
name: Bug report
about: You've found a bug with Renovate
labels: 'type:bug, status:requirements, priority-5-triage'
---

<!--
      PLEASE DO NOT REPORT ANY SECURITY CONCERNS THIS WAY
      Email renovate-disclosure@whitesourcesoftware.com instead.
-->

**What Renovate type, platform and version are you using?**

<!-- Tell us if you're using the hosted App, or if you are self-hosted Renovate yourself. Platform too (GitHub, GitLab, etc) plus which version of Renovate if you're self-hosted. -->

**Describe the bug**

<!-- A clear and concise description of what the bug is. -->

**Relevant debug logs**

<!--
Try not to raise a bug report unless you've looked at the logs first.

If you're running self-hosted, run with `LOG_LEVEL=debug` in your environment variables and search for whatever dependency/branch/PR that is causing the problem. If you are using the Renovate App, log into https://app.renovatebot.com/dashboard and locate the correct job log for when the problem occurred (e.g. when the PR was created).

Paste the *relevant* logs here, not the entire thing and not just a link to the dashboard (others do not have permissions to view them).
-->

<details><summary>Click me to see logs</summary>

```
Copy/paste any log here, between the starting and ending backticks
```

</details>

**Have you created a minimal reproduction repository?**

Please read the [minimal reproductions documentation](https://github.com/renovatebot/renovate/blob/master/docs/development/minimal-reproductions.md) to learn how to make a good minimal reproduction repository.

- [ ] I have provided a minimal reproduction repository
- [ ] I don't have time for that, but it happens in a public repository I have linked to
- [ ] I don't have time for that, and cannot share my private repository
- [ ] The nature of this bug means it's impossible to reproduce publicly

**Additional context**

<!-- Add any other context about the problem here, including your own debugging or ideas on what went wrong. -->
