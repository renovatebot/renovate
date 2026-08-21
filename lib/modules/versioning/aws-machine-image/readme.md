Renovate's AWS Machine Image versioning is a kind of hack to support Amazon Machine Images (AMI) updates.

At the moment every AMI that matches the regex `^ami-[a-z0-9]{17}$` is considered a valid "release".
