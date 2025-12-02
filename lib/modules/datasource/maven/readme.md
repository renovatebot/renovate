#### Maven Central rate limiting and caching

Maven Central, hosted by Sonatype, receives a very large number of requests and has implemented rate limiting measures to manage organizational overconsumption.
If you're experiencing 429 (rate limited) responses from Maven Central, you may need to optimize your caching strategy.

Renovate includes Maven caching optimizations, but they rely on having a _persistent_ datasource cache.
By default, Renovate uses a file-based cache, which means:

- **Persistent environments** (like self-hosted runners with persistent storage) will benefit from cross-run caching
- **Ephemeral environments** (like GitHub Actions or other CI/CD with fresh containers each run) won't benefit from caching across runs

To maximize caching effectiveness and reduce Maven Central requests:

1. **Use Redis for persistent caching**: Configure a Redis instance for your Renovate datasource cache
2. **Ensure cache persistence**: If using file-based caching, ensure the cache directory persists between Renovate runs
3. **Monitor rate limit warnings**: Renovate will log warnings when receiving 429 responses from Maven Central

If you continue to experience rate limiting issues after implementing persistent caching, you may need to:

- Reduce the frequency of Renovate runs
- Consider using a Maven repository proxy with its own caching layer

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

When `latest` or `release` values are present in a package's `maven-metadata.xml`, Renovate will map these to its `tags` concept.
This enables the use of Renovate's `followTag` feature.

However, Renovate will set `respectLatest=false` whenever the `latest` tag is found, because many Maven registries have been found to populate the tag unreliably.
You should use `packageRules` to set `respectLatest=true` if you wish to use this feature.
