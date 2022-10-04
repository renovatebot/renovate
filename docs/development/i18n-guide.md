# Renovate i18n Guide

This document briefs how to provide translatable to user-facing text, how to contribute code for i18n, and what is your recommended way/style to do that.

This document quotes some definitions and segments from the manual of [GNU Gettext](https://www.gnu.org/software/gettext/manual/gettext.html).

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

- Text in logs: To `i18n`, we aim users is not the administrator of self-hosting instance, the text in logs should be easy to search in correspond code base, which easyer for problem diagnosis.
- Console output: The reason is same with text in logs.
- Technical term: Renovate have a lot of technical terms in its user-facing text .e.g. `monorepo`, `maven`, `Pull Request`, `PR`, English
  is common language at technical area, we should respect that tradition.

Rest user-facing text should be considered translatable.

### Where is the POT file?

We put the POT(Portable Object Template) file to a separted repository renovatebot/renovate-i18n. There is a Github actino sync and update the POT file every day.

### Where is the PO files?

We only provide POT file and everyone can translate a own edition by it. For example, a [zh_CN](https://github.com/xingxing/renovate-i18n-zh-cn) edition.

### Use "\_"(single underline) instead of "gettext" function

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

### Preparing Translatable Strings

This segment comes from [the manual](https://www.gnu.org/software/gettext/manual/html_node/Preparing-Strings.html#Preparing-Strings) of GNU gettext. However, I modified code examples with Typescript, because the original they are written by C language, and not all of us know C language well.

#### Decent English style

Translatable strings should be in good English style. If slang language with abbreviations and shortcuts is used, often translators will not understand the message and will produce very inappropriate translations.

```typescript
'%s: is parameter\n';
```

This is nearly untranslatable: Is the displayed item a parameter or the parameter?

```typescript
'No match';
```

The ambiguity in this message makes it unintelligible: Is the program attempting to set something on fire? Does it mean "The given object does not match the template"? Does it mean "The template does not fit for any of the objects"?

In both cases, adding more words to the message will help both the translator and the English speaking user.

#### Entire sentences

Translatable strings should be entire sentences. It is often not possible to translate single verbs or adjectives in a substitutable way.

```typescript
util.format('File %s is %s protected', filename, rw ? 'write' : 'read');
```

Most translators will not look at the source and will thus only see the string "File %s is %s protected", which is unintelligible. Change this to

```typescript
util.format(
  rw ? 'File %s is write protected' : 'File %s is read protected',
  filename
);
```

This way the translator will not only understand the message, she will also be able to find the appropriate grammatical construction. A French translator for example translates "write protected" like "protected against writing".

Entire sentences are also important because in many languages, the declination of some word in a sentence depends on the gender or the number (singular/plural) of another part of the sentence. There are usually more interdependencies between words than in English. The consequence is that asking a translator to translate two half-sentences and then combining these two half-sentences through dumb string concatenation will not work, for many languages, even though it would work for English. That’s why translators need to handle entire sentences.

Often sentences don’t fit into a single line. If a sentence is output using two subsequent printf statements, like this

```typescript
util.format(`Locale charset "%s" is different from\n`, lcharset);
util.format(`input file charset "%s".\n`, fcharset);
```

the translator would have to translate two half sentences, but nothing in the POT file would tell her that the two half sentences belong together. It is necessary to merge the two printf statements so that the translator can handle the entire sentence at once and decide at which place to insert a line break in the translation (if at all):

```typescript
util.format(
  `Locale charset "%s" is different from
input file charset "%s".
`,
  lcharset,
  fcharset
);
```

You may now ask: how about two or more adjacent sentences? Like in this case:

```typescript
console.log('Apollo 13 scenario: Stack overflow handling failed.');
console.log('On the next stack overflow we will crash!!!');
```

Should these two statements merged into a single one? I would recommend to **merge** them if the two sentences are related to each other, because then it makes it easier for the translator to understand and translate both. On the other hand, if one of the two messages is a stereotypic one, occurring in other places as well, you will do a favour to the translator by not merging the two. (Identical messages occurring in several places are combined by xgettext, so the translator has to handle them once only.)

#### Split at paragraphs

Translatable strings should be limited to one paragraph; don’t let a single message be longer than ten lines. The reason is that when the translatable string changes, the translator is faced with the task of updating the entire translated string. Maybe only a single word will have changed in the English string, but the translator doesn’t see that (with the current translation tools), therefore she has to proofread the entire message.

Many GNU programs have a ‘--help’ output that extends over several screen pages. It is a courtesy towards the translators to split such a message into several ones of five to ten lines each. While doing that, you can also attempt to split the documented options into groups, such as the input options, the output options, and the informative output options. This will help every user to find the option he is looking for.

#### No string concatenation

Hardcoded string concatenation is sometimes used to construct English strings:

```typesript
let s = "Replace ";
s += object1;
s += " with ";
s += object2;
s += "?";
```

In order to present to the translator only entire sentences, and also because in some languages the translator might want to swap the order of object1 and object2, it is necessary to change this to use a format string:

```c
util.format(s, "Replace %s with %s?", object1, object2);
```

A similar case is compile time concatenation of strings. The ISO C 99 include file <inttypes.h> contains a macro PRId64 that can be used as a formatting directive for outputting an ‘int64_t’ integer through printf. It expands to a constant string, usually "d" or "ld" or "lld" or something like this, depending on the platform. Assume you have code like

```c
printf ("The amount is %0" PRId64 "\n", number);
```

The gettext tools and library have special support for these <inttypes.h> macros. You can therefore simply write

```c
printf (gettext ("The amount is %0" PRId64 "\n"), number);
```

The PO file will contain the string `"The amount is %0<PRId64>\n"`. The translators will provide a translation containing `"%0<PRId64>"` as well, and at runtime the gettext function’s result will contain the appropriate constant string, "d" or "ld" or "lld".

This works only for the predefined <inttypes.h> macros. If you have defined your own similar macros, let’s say ‘MYPRId64’, that are not known to xgettext, the solution for this problem is to change the code like this:

```c
char buf1[100];
sprintf (buf1, "%0" MYPRId64, number);
printf (gettext ("The amount is %s\n"), buf1);
```

This means, you put the platform dependent code in one statement, and the internationalization code in a different statement. Note that a buffer length of 100 is safe, because all available hardware integer types are limited to 128 bits, and to print a 128 bit integer one needs at most 54 characters, regardless whether in decimal, octal or hexadecimal.

All this applies to other programming languages as well. For example, in Java and C#, string concatenation is very frequently used, because it is a compiler built-in operator. Like in C, in Java, you would change

```java
System.out.println("Replace "+object1+" with "+object2+"?");
```

into a statement involving a format string:

```java
System.out.println(
    MessageFormat.format("Replace {0} with {1}?",
                         new Object[] { object1, object2 }));
```

Similarly, in C#, you would change

```c#
Console.WriteLine("Replace "+object1+" with "+object2+"?");
```

into a statement involving a format string:

```c#
Console.WriteLine(
    String.Format("Replace {0} with {1}?", object1, object2));
```

#### No embedded URLs

It is good to not embed URLs in translatable strings, for several reasons:

- It avoids possible mistakes during copy and paste.
- Translators cannot translate the URLs or, by mistake, use the URLs from other packages that are present in their compendium.
- When the URLs change, translators don’t need to revisit the translation of the string.

The same holds for email addresses.

So, you would change

```typescript
console.log(_('GNU GPL version 3 <https://gnu.org/licenses/gpl.html>\n'));
```

to

```typescript
console.log(
  util.format(
    _('GNU GPL version 3 <%s>\n'),
    'https://gnu.org/licenses/gpl.html'
  )
);
```

#### No unusual markup

Unusual markup or control characters should not be used in translatable strings. Translators will likely not understand the particular meaning of the markup or control characters.

For example, if you have a convention that ‘|’ delimits the left-hand and right-hand part of some GUI elements, translators will often not understand it without specific comments. It might be better to have the translator translate the left-hand and right-hand part separately.

Another example is the ‘argp’ convention to use a single ‘\v’ (vertical tab) control character to delimit two sections inside a string. This is flawed. Some translators may convert it to a simple newline, some to blank lines. With some PO file editors it may not be easy to even enter a vertical tab control character. So, you cannot be sure that the translation will contain a ‘\v’ character, at the corresponding position. The solution is, again, to let the translator translate two separate strings and combine at run-time the two translated strings with the ‘\v’ required by the convention.

HTML markup, however, is common enough that it’s probably ok to use in translatable strings. But please bear in mind that the GNU gettext tools don’t verify that the translations are well-formed HTML.
