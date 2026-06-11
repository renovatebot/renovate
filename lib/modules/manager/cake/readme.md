Extracts dependencies from `*.cake` files.

It can also extract `dotnet:` tool packages when used in .NET single file builds, when they are used with the `InstallTool` or `InstallTools` method. Keep in mind that those files are usually not `*.cake` files but C# code files. Those are not included in the `managerFilePatterns` per default - make sure to include them manually in your configuration if you want to use this feature.`#:package`or`#:sdk` directives are not handled by the cake manager as this is a dotnet feature. Those are separately handled by the nuget manager.
