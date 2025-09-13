Extracts dependencies from the Deno's projects `deno.json` and `deno.jsonc` files.  
The deno manager also supports the `package.json` file for Deno's [node-compat](https://docs.deno.com/runtime/fundamentals/node/) as long as a `deno.lock` file is placed next to the `package.json` file.

### Supported Dependency Types

The following `depTypes` of `deno.json` or `deno.jsonc` are currently supported by the deno manager:

- `imports`
- `scopes.<mapping>.<specifier>`
- `tasks.<name>`, `tasks.command.<name>`: Renovate will not update any lock files.
- `compilerOptions.types`, `compilerOptions.jsxImportSource`, `compilerOptions.jsxImportSourceTypes`
- `lint.plugins`

Additionally, an [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap) JSON file containing `imports` and `scopes.<mapping>.<specifier>` like the examples above is supported.

The deno manager also supports some `depTypes` that supported by [npm manager](../npm/index.md).

<!-- prettier-ignore -->
!!! note
    Deno cli supports [private npm compatible registries](https://docs.deno.com/runtime/fundamentals/node/#private-registries) itself, however the deno managaer is not yet ready to support [Private npm module](../../../getting-started/private-packages.md#npm).

<!-- prettier-ignore -->
!!! note
    In source dependencies are not supported.  
    ```ts
    import { assert } from "jsr:@std/assert@1.0.0";
    ```
