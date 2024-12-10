This datasource uses
[the Hackage JSON API](https://hackage.haskell.org/api#package-info-json)
to fetch versions for published Haskell packages.

While not all versions use [PVP](https://pvp.haskell.org), the majority does.
This manager assumes a default versioning set to PVP.
Versioning can be overwritten using `packageRules`, e.g. with `matchDatasources`.
