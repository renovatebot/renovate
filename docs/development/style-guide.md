# Renovate style guide

This document describes the correct style for user-facing text in the:

- Documentation
- Error and debug messages
- Texts created by the bot in issues and pull requests

## Use American English

Set your spell checker to the correct language.

Guidelines:

- Use `ize` instead of `ise` in words like customize and analyze
- Drop the British `u` in words like behavior

## One sentence per line

In Markdown files, use one sentence per line.
Like this:

```markdown
First sentence on one line.
Second sentence on a new line.
And so on.
```

## Avoid contractions/possessives

Avoid:

```markdown
don't
won't
doesn't
shouldn't
wouldn't
manager's
file's
```

Do:

```markdown
do not
will not
does not
should not
would not
```

Avoid possessives like `manager's` or `file's`, if needed rewrite the sentence.

## Avoid manually ordering numbered lists

Avoid:

```markdown
1. First item
2. Second item
3. Third item
```

Do:

```markdown
1. First item
1. Second item
1. Third item
```

## Avoid punctuation at the end of list items

In Markdown files, avoid punctuation at the end of a list item.
Like this:

```markdown
- List item, no punctuation at the end
```

## Use plain language

Follow the [Plain language guidelines](https://www.plainlanguage.gov/guidelines/).

## Correct name for the GitHub app

Refer to the GitHub app version of Renovate as "the Mend Renovate app".
