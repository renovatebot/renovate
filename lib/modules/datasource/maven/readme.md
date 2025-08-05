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

#### latest and release tags

Although a package's `maven-metadata.xml` may contain `latest` and `release` tags, we do not map them to `tags.latest` or `tags.release` in Renovate internal data.
The reason for not doing this is that Maven registries don't use these tags as an indicator of stability - `latest` essentially means "the most recent version which was published".

For more information on this, see the analysis done in [Discussion #36927](https://github.com/renovatebot/renovate/discussions/36927).

As a result, neither `followTag` nor `respectLatest` concepts apply to Maven dependencies.
