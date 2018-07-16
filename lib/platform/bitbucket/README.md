# Bitbucket platform

## Credentials setup

### How to get

BITBUCKET_TOKEN for now is base64 encoded string of your `username:bbaAppPassword`.

Where `bbaAppPassword` is Bitbucket App password, which you can revoke. Read more here, how to create one https://confluence.atlassian.com/bitbucket/app-passwords-828781300.html.

to get it in node run this in repl:

```
const btoa = str => Buffer.from(str, 'binary').toString('base64');

btoa(`${user}:${bbaAppPassword}`)
```

to get it in browser, run this in console:

```
btoa(`${user}:${bbaAppPassword}`)
```

### How to expose

Expose it temporarily, by running this in your shell:

```
$ export BITBUCKET_TOKEN='your-token-here-dont-show-it-to-anyone'
```

or add it to your `~/.bash_profile` to keep it permanent:

```
$ echo "export BITBUCKET_TOKEN='your-token-here-dont-show-it-to-anyone'" >> ~/.bash_profile
```
