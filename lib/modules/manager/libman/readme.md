Extracts client-side library dependencies from `libman.json` files used by [LibMan](https://learn.microsoft.com/aspnet/core/client-side/libman/), Microsoft's Library Manager for acquiring static content (JavaScript, CSS, etc.) in ASP.NET Core and other .NET/Visual Studio projects.

LibMan supports several "providers" for resolving libraries.

| LibMan provider | Renovate support                                              |
| --------------- | ------------------------------------------------------------- |
| `cdnjs`         | supported via `cdnjs` datasource                              |
| `jsdelivr`      | Currently unsupported; skipped as an `unsupported-datasource` |
| `unpkg`         | Currently unsupported; skipped as an `unsupported-datasource` |
| `filesystem`    | Local files; skipped as a `local-dependency`                  |
