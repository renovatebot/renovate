# Cache decoder

There is a [online decoder for cached data](https://docs.renovatebot.com/cache-decoder/) available.

Suppose you have data:

```json
{
  "fingerprint": "0123456789abcdef",
  "hash": "756a22cbd28854a64687fa5e458eb1da5b51958d7b329094f4a152dc4dc533dd26213f97fdc10f2480784aa667382ef671d820c1625bb694542a99f8a709be45",
  "payload": "Gx0A8EVPlvpLVKVkJggn0ExJYlEsqcMErTZdm8wdCOAB",
  "repository": "some/repo",
  "revision": 13
}
```

If you paste it to the left input, you'll get the decoded data copied to your clipboard:

<img width="1152" alt="imagen" src="https://user-images.githubusercontent.com/1239644/198538355-915b3110-4cc2-4e5b-ba24-d524617a7b4c.png">

As an option, you can paste only payload field (e.g. `Gx0A8EVPlvpLVKVkJggn0ExJYlEsqcMErTZdm8wdCOAB`).
