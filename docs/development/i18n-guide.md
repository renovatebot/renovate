# Renovate i18n Guide

This document aims the developers who want to improve i18n or create his/her own translations.

## Context

First things first, you should understand some basic context around `i18n` and `GNU Gettext`, so when you begin to contribute for Renovate, we are already on the same page.

Even you familiar to these concepts, please read the segment [Best practice](## Best practice), we will put all recommended implementation and unique stuff for Renovate there.

### What is i18n and why we should do it?

The term are frequently abbreviated to the numeronyms i18n, where 18 stands for the number of letters between the first `i` and the last `n` in the word `internationalization`.

By internationalization, one refers to the operation by which a program, or a set of programs turned into a package, is made aware of and able to support multiple languages.

Renovate contain a lot of user-facing text(the user at here are end-user, instead of the administrator of self-hosting instance), for instance: description of on-borading PRs, description of ugrading PRs, dependency dashboard etc.

But the users comes from different countries, most people are less comfortable with English than with their own native language, and would prefer to use their mother tongue for day to day’s work, as far as possible.

Renovate is expected a daily tools for user, so the user friendly matters.

### Technics under the hood

Renovate introduced [GNU Gettext](https://www.gnu.org/software/gettext/) to support i18n.

The GNU _gettext_ utilties are a set of tools that provides i18n to other software systems. Please check its offical website for more infomations.

## Best pratice

### What's the translatble text?

Or in other word what's the text we do **not** consider to translate:

- Text in log: To `i18n`, we aim users is not the administrator of self-hosting instance, the text in logs should be easy to search in correspond code base, which easyer for problem diagnosis.
- Console output: The reason is same with text in logs.
- Technical term: Renovate have a lot of technical terms in its user-facing text .e.g. `monorepo`, `maven`, `Pull Request`, `PR`, English
  is common language at technical area, we should respect that tradition.
- Text can be customized, e.g. `onboardingPrTitle`, `prFooter`, `prBodyColumns` .etc.

The rest of user-facing text should be considered translatable.

### Where is the POT file?

We put the POT(Portable Object Template) file to a separted repository renovatebot/renovate-i18n. There is a Github actino sync and update the POT file every day.

### Where is the PO files?

We only provide POT file and everyone can translate a own edition by it. For example, a [zh_CN](https://github.com/xingxing/renovate-i18n-zh-cn) edition.

### Use '\_'(single underline) instead of 'gettext' function

The `_` function is [formal keyword](https://www.gnu.org/software/gettext/manual/html_node/Mark-Keywords.html) , it is equivalent to the function `gettext`, and it is shorter than `gettext` obviously.

So the textual overhead per translatable string is reduced to only three characters: the underline and the two parentheses.

### Prevent string interpolation

This is a common and critical problem in gettext usage.

The `xgettext` program of `gettext` tools will extract translatable strings from the source code, hance those strings must be literals, in other word, they can not contain any expressions that attempt to be evaluated.

We have to adjust them with `util.format` and its sibling.

For example:

```typescript
const answer = 'two';
let result: string = `one plus one should be equal ${answer}`;
```

have to change to

```typescript
const answer = 'two';
let result: string = util.format(_('one plus one should be equal %s'), answer);
```

### Prevent multiple-lines function call for Gettext functions

We prefer

```typescript
pgettext('context', 'the text you wanna translate');
```

than

```typescript
pgettext('context', 'the text you wanna translate');
```

Sometimes, the `xgettext` program, which extracts translatable strings from the code base, can not determine the function call of the latter style.

That might be a bug of Gettext utilities.

### Preparing Translatable Strings

Please read [the manual](https://www.gnu.org/software/gettext/manual/html_node/Preparing-Strings.html#Preparing-Strings) of GNU gettext.

### Create your own translate edition

We put the POT file and relevant scripts to a separate repository.

You can clone [renovatebot/renovate-i18n](renovatebot/renovate-i18n), manually update the `messages.pot`, or wait for the daily action to update that file, please read documents about i18n in that project for more details.

And then you can translate your own edition by invoking `msginit` program, and then invoke `msgmerge` program to add more `msgid`, refer the repository [xingxing/renovate-i18n-zh-cn](xingxing/renovate-i18n-zh-cn).
