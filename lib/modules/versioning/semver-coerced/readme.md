Renovate's Coerced Semantic Versioning is a forgiving variant of [Semantic Versioning 2.0](https://semver.org) with coercion enabled for versions.

This versioning provides a very forgiving translation of inputs in non-strict-SemVer format into strict SemVer.
For example, "v1" is coerced into "1.0.0", "2.1" => "2.1.0", "~3.1" => "3.1.0", "1.1-foo" => "1.1.0".
Look at the Coercion section of [this page](https://www.npmjs.com/package/semver) for more info on input coercion.

Since this versioning is very forgiving, it doesn't actually provide the coercion for version ranges.
The range functions only accept strict SemVer as input and equivalent to those provided by the Renovate's semver versioning.
