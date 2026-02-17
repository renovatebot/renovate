Extracts dependencies from Cake.Sdk build scripts (`cake.cs`, `build.cs`).

### Opt-in: check all `.cs` files

By default only `cake.cs` and `build.cs` are matched. To let the manager consider every `.cs` file (e.g. for multi-file builds or custom script names), set `managerFilePatterns` for the `cake-sdk` manager:

```json
{
  "cake-sdk": {
    "managerFilePatterns": ["/\\.cs$/"]
  }
}
```

Files that do not contain any Cake.Sdk directives or `InstallTool(s)` will simply yield no dependencies.

Supports:

- `#:sdk Cake.Sdk@version` – Cake.Sdk version
- `#:package PackageName@version` – Cake modules/recipes (e.g. `#:package Cake.Sonar@5.0.0`)
- `InstallTool("nuget:...")` / `InstallTool("dotnet:...")` – single tool
- `InstallTools("...", "...")` – multiple tools (same `nuget:` / `dotnet:` URL format as Cake.Tool)

Tool strings use the same format as the [Tool directive](https://cakebuild.net/docs/writing-builds/preprocessor-directives/tool/) (e.g. `nuget:?package=Name&version=1.0.0`, `dotnet:https://api.nuget.org/v3/index.json?package=Name&version=1.0.0`).
