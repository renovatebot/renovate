<!-- prettier-ignore -->
!!! warning
    Renovate does not support Composer version `2.5.0` or newer.
    This is because of changes in the default behavior of Composer.
    For now, you can do ... to workaround the problem.
    Subscribe to these issues/discussions to follow our progress: insert link to issues.

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
