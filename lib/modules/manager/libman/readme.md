Extracts client-side library dependencies from `libman.json` files used by [LibMan](https://learn.microsoft.com/aspnet/core/client-side/libman/), Microsoft's Library Manager for acquiring static content (JavaScript, CSS, etc.) in ASP.NET Core and other .NET/Visual Studio projects.

## Supported providers

LibMan supports several "providers" for resolving libraries.

| LibMan provider | Renovate datasource                                                    |
| --------------- | ---------------------------------------------------------------------- |
| `cdnjs`         | [`cdnjs`](../../datasource/cdnjs)                                      |
| `jsdelivr`      | [`jsdelivr`](../../datasource/jsdelivr) (npm- and gh-backed libraries) |
| `unpkg`         | [`unpkg`](../../datasource/unpkg)                                      |
| `filesystem`    | Local files; Ignored by the manager as a `local-dependency`            |
