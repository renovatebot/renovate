Configuration for Maven Wrapper updates.
Changes here affect how Renovate updates the version of Maven in the wrapper, not how it uses the wrapper.

### Private registry authentication

If the Maven wrapper downloads artifacts from a private registry, Renovate can pass credentials to the wrapper command automatically.

When Renovate finds a custom repository URL in the wrapper configuration, it looks for matching `hostRules` with `hostType: "maven"` and passes the credentials to the wrapper command.

Both `username` and `password` must be set in the host rule for authentication to apply.

Example `hostRules` configuration:

```json
{
  "hostRules": [
    {
      "matchHost": "private-registry.example.com",
      "hostType": "maven",
      "username": "renovate-bot",
      "password": "{{ secrets.MAVEN_PASSWORD }}"
    }
  ]
}
```

To learn more about how to securely provide credentials, see [Private package support](../../../getting-started/private-packages.md).
