Extracts dependencies from `composer.json` files, and keeps the associated `composer.lock` file updated too.

If you use [VCS repositories](https://getcomposer.org/doc/05-repositories.md#vcs) then Renovate needs a hint via the `name` property, which must match the relevant package.
For example, the package `acme/foo` would need an entry in [repositories](https://getcomposer.org/doc/04-schema.md#repositories) similar to the following:

```json
{
  "name": "acme/foo",
  "type": "vcs",
  "url": "http://vcs-of-acme.org/acme/foo.git"
}
```
