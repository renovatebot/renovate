Renovate's amazon machine image versioning is a kind of hack to support ami updates.

At the moment every ami that matches the regex `^ami-[a-z0-9]{17}$` is considered as a valid "releases"
