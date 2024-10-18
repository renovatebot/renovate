# Switching bot identity

Renovate uses its bot identity to know:

- if a PR is authored by Renovate bot
- if you, or some other bot, pushed commits into the PR branch
- Editor note: list other things Renovate uses the bot id for here

## Reasons to switch bot identity

Common reasons to switch bot identity are:

- Migrating between Mend-hosted and self-hosted
- Renaming the bot (self-hosted)
- Editor note: Maybe there are other reasons too, please comment

### Migrating from Mend-hosted to self-hosted

Most users start with the Mend-hosted bot, and are happy with this.
After a while, some users want to switch to self-hosting, for more control.

When you migrate you must tell your new self-hosted Renovate bot to take over from the old Mend-hosted bot.

### Renaming the bot (self-hosted)

Maybe you started self-hosting Renovate, and called your bot `@old-bot-name`.
But the name no longer fits, so you want to use `@new-bot-name`.

Follow these steps:

1. Start of ordered list with steps
1. Second step
1. Third step, and so on

### Other situations

Editor note: Please comment about other cases where you need to switch bot identity.

## How to switch bot identity

Looks like the steps are:

1. Put old bot name in the `gitIgnoredAuthors` config option
1. Set `ignorePrAuthor` to `true`
1. Let the "new" bot take over from the "old bot"

## Questions from the editor

- Is the `gitAuthor` field the bot identity?
- What's `gitIgnoredAuthors` for? It looks like you can ignore commits from the old bot with it?
- We also have `ignorePrAuthor` which if set to `true` fetches the _whole_ list of PRs, instead of just fetching Renovate PRs. The docs say this is the one to use to ignore old bot names. But the description of `ignorePrAuthor` only mentions the full list fetching, nothing about the name/id of the bot.
- It's easy to confuse `gitIgnoredAuthors` and `ignorePrAuthor` they have similar names, but do different things.
