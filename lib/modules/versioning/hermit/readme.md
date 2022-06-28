Hermit versioning is a mix of `semver` and `channel`.

**Semver**

Hermit's semver was the untangled versions comes back from package's tag.
It supports major, minor, patch and also build number in the semver.
An example of that is from OpenJDK `15.0.1_9`.

**Channel**

[Channel](https://cashapp.github.io/hermit/packaging/reference/#channels) could be hermit generated or user defined.
Channel is considered unstable version and normally won't upgrade.
If you would like to get out of Channel, you could replace the Channel with a given version number and let it managed by Renovate ongoing.
