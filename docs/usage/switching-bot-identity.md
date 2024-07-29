# Switching bot identity

Renovate uses its bot identity to know:

- if a PR is authored by Renovate bot
- if you, or some other bot pushed commits into the PR branch
- list other things Renovate uses the bot ID for here

This makes having the correct bot identity very important.

## Reasons to switch bot identity

Common reasons to switch bot identity are:

- Migrating from Mend-hosted to self-hosted
- Renaming the bot (self-hosted)
- Editor note: Maybe there are other reasons too, please comment

### Migrate from Mend-hosted to self-hosted

Most users start with the Mend-hosted bot, and will let Mend keep hosting their bot.
Some users want to start self-hosting the bot, to have full control.

When you migrate you have to tell your self-hosted Renovate bot to take over from the old Mend-hosted bot.

### When you rename the bot (self-hosted)

Maybe you started self-hosting Renovate, and called your bot `@old-bot-name`.
But the name no longer fits, so you want to use `@new-bot-name`.

Follow these steps:

1. Start of ordered list with steps
1. Second step
1. Third step, and so on

### Other situations

Editor note: Please comment about other cases where you need to switch bot identity.

## How to switch bot identity

Stub for developers to fill out with technical bits.

It looks like the steps are:

1. Put old bot name in the `gitIgnoredAuthors` config option
1. Set `ignorePrAuthor` to `true`
1. Let the "new" bot take over from the "old bot"

Questions:

- Is gitAuthor the bot ID?
- What's `gitIgnoredAuthors` for? It looks like you can ignore commits from the old bot. Normally Renovate considers PR "touched by the user" if it sees a different Git author?
- We also have `ignorePrAuthor` which if set to `true` fetches the _whole_ list of PRs, instead of just fetching Renovate PRs. The docs say this is the one to use to ignore old bot names.
