### Fetching changelogs from API

In case your repository doesn't hold a `CHANGELOG.md` file and you need to fetch changelogs from an API (just like the one from [Gitlab](https://docs.gitlab.com/ee/api/releases) or [Github](https://docs.github.com/en/rest/releases)), you need to configure `Maven` so that `renovatebot` is able to determine the `sourceUrl` when fetching info about the artifact.

To do so, you need to configure the [scm section](https://maven.apache.org/scm/git.html) on the `pom.xml` of the given artifact.

For example:

```xml
<scm>
    <url>scm:git:https://github.com/path_to_repository</url>
</scm>
```

<!-- prettier-ignore -->
!!! note
    This also works for private repositories.
    It can leverage the same `token that you had to configure in order to be able to reach the private Artifactory.