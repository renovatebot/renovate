Renovate's Node.js versioning is a wrapper around npm versioning.
But Renovate removes any `v` prefixes from semantic versions when replacing.

Its primary purpose is to add Node.js LTS awareness:

- A new major release is not treated as stable immediately; it becomes stable once its release line reaches LTS.
- Pre-release versions such as `27.0.0-alpha.1` are always treated as unstable.

Up to Node.js 26 the release lines followed an odd/even scheme, where odd-numbered majors never reached LTS.
From Node.js 27 onwards [the schedule changed](https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule): every major eventually becomes LTS, so stability is derived from the release schedule rather than the major number being odd or even.

You can _not_ use `node` versioning to replace `docker` versioning if you are using node tags with suffixes like `-alpine`.
This is because npm versioning treats these suffixes as implying pre-releases/instability.
