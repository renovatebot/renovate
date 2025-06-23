#### Making your changelogs fetchable

In case you are publishing artifacts and you want to ensure that your changelogs are fetchable by `Renovate`, you need to configure the [scm section](https://maven.apache.org/scm/git.html) on their `pom.xml` file.

For example:

```xml
<scm>
    <url>scm:git:https://github.com/path_to_repository</url>
</scm>
```

This is what allows `Renovate` to determine the `sourceUrl`, that it then uses to fetch the changelogs.

<!-- prettier-ignore -->
!!! note
    This also works for private repositories.
    It can leverage the same `token` that you had to configure in order to be able to reach the private Artifactory.

#### Specifying your project homepage

When opening a Pull Request `Renovate` uses the top level `url` property to determine the homepage of your project and shows it inside the Pull Request.
To customize you can set it inside your `pom.xml`.

For example:

```xml
<url>https://project.example.com</url>
```
