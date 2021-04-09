Docker doesn't really have _versioning_, instead it supports "tags" and these are usually used by Docker image authors as a form of versioning.

This Docker versioning implementation in Renovate is designed to handle the most common _conventions_ used in tagging images. In particular, it treats the text after the first hyphen as a type of platform/compatibility indicator.

For example, many images include images with the "-alpine" suffix, e.g. the official `node` Docker image includes tags like `12.15.0-alpine` which is _not_ compatible with `12.15.0` or `12.15.0-stretch`. This means users only want/expect upgrades to `12.16.0-alpine` and not `12.16.0` or `12.16.0-stretch`.

Similarly, a user with `12.14` expects to be upgraded to `12.15` and not `12.15.0`.

**What type of versioning is used?**

It's pretty "wild west" for tagging and not always compliant with SemVer. Docker versioning in Renovate should do a best effort to accept and sort SemVer-like versions.

**Are ranges supported?**

No. Although a tag like `12.15` might seem like it means `12.15.x`, it is a tag of its own and may or may not point to an of the available `12.15.x` tags, including `12.15.0`.

**Are commit hashes supported?**

No. An image tag that looks like a Git commit hash should be ignored by Renovate.
