Docker images don't really have _versions_, instead they have "tags".
Tags are often used by Docker image authors as a form of versioning.

Renovate tries to follow the most common _conventions_ that are used to tag Docker images.
In particular, Renovate treats the text after the first hyphen as a type of platform/compatibility indicator.

For example, many images have releases with the `-alpine` suffix.
The official `node` Docker image has tags like `12.15.0-alpine` which is _not_ compatible with `12.15.0` or `12.15.0-stretch`.
Users on `-alpine` don't want updates to `12.16.0` or `12.16.0-stretch`.
Those users only want upgrades to `12.16.0-alpine` and not `12.16.0` or `12.16.0-stretch`.

Similarly, a user on `12.14` expects to be upgraded to `12.15` and not `12.15.0`.

**What type of versioning is used?**

Docker image authors can use whatever tag they want, it's a "wild west".
Docker tags don't always follow SemVer.
This means that Renovate tries to accept and sort SemVer-like versions, but this won't always work.

You may need to help Renovate and create your own rules for some Docker images.
For example:

```json
{
  "packageRules": [
    {
      "matchDatasources": ["docker"],
      "matchPackageNames": ["badly-versioned-docker-image"],
      "versioning": "loose"
    }
  ]
}
```

**Are ranges supported?**

No.
You may think a tag like `12.15` also means `12.15.x`, but it's a tag of its own.
The `12.15` tag may or may not point to any of the available `12.15.x` tags, including `12.15.0`.

**Are commit hashes supported?**

No, Renovate ignores Docker image tags that look like a Git commit hash.
