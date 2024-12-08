This datasource uses [the Hackage JSON
API](https://hackage.haskell.org/api#package-info-json) to fetch versions for
published Haskell packages.

While not all versions use PVP, the majority does, and this manager assumes a
default versioning set to [PVP](https://pvp.haskell.org). This can be
overwritten using `packageRules` with e.g. `matchDatasources`.
