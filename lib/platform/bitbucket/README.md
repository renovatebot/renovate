# BitBucket platform

## Credentials setup

### How to get

BB_TOKEN for now is base64 encoded string of your `username:bbaAppPassword`.

Where `bbaAppPassword` is BitBucket App password, which you can revoke. Read more here, how to create one https://confluence.atlassian.com/bitbucket/app-passwords-828781300.html.

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
$ export BB_TOKEN='your-token-here-dont-show-it-to-anyone'
```

or add it to your `~/.bash_profile` to keep it permanent:

```
$ echo "export BB_TOKEN='your-token-here-dont-show-it-to-anyone'" >> ~/.bash_profile
```

## Sandbox for debugging:

We use `./cli.js` file from the gist as a sandbox for debugging.

get it here https://gist.github.com/iamstarkov/725d20bc5fbf402b785eba06ff9c04c1

Test your requests:

```
$ node cli
```
