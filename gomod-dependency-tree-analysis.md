# Go Modules Dependency Tree Analysis

## Issue Overview

**Issue**: [#12999 - Indirect dependencies in dependent go modules need to be updated](https://github.com/renovatebot/renovate/issues/12999)

**Problem**: When Renovate updates a Go module in a monorepo, it needs to also update dependent modules that reference it via `replace` directives. Currently, updating module A fails because module B (which depends on A via `replace ../a`) has stale indirect dependencies that need to be updated simultaneously.

## Current Architecture Analysis

### 1. Current gomod Manager Implementation

**File Structure**:

- `lib/modules/manager/gomod/extract.ts` - Parses go.mod files
- `lib/modules/manager/gomod/line-parser.ts` - Parses individual lines (require, replace, etc.)
- `lib/modules/manager/gomod/artifacts.ts` - Handles artifact updates (go.sum, go.mod)
- `lib/modules/manager/gomod/update.ts` - Updates dependency versions

**Current Behavior**:

- Processes each `go.mod` file independently
- Uses `managerFilePatterns: ['/(^|/)go\\.mod$/']` to discover files
- Handles `replace` directives but marks local ones as `skipReason: 'local-dependency'`
- Runs `go get`, `go mod tidy` only in the current module's directory
- No awareness of inter-module dependencies

**Key Limitations**:

- No dependency graph building
- No coordination between related modules
- Local `replace` directives are ignored
- Single-module update approach fails for dependent modules

### 2. NuGet Manager Reference Implementation

**File Structure**:

- `lib/modules/manager/nuget/package-tree.ts` - **Graph builder module**
- `lib/modules/manager/nuget/extract.ts` - Parses project files
- `lib/modules/manager/nuget/artifacts.ts` - Handles artifact updates

**Key Features**:

```typescript
// Uses graph-data-structure library
import { Graph, hasCycle } from 'graph-data-structure';

// Builds dependency graph of project files
export async function getDependentPackageFiles(
  packageFileName: string,
  isCentralManagement = false,
): Promise<ProjectFile[]> {
  const packageFiles = await getAllPackageFiles();
  const graph = new Graph();

  // Add nodes and edges based on ProjectReference elements
  for (const ref of normalizedRelativeProjectReferences) {
    graph.addEdge(ref, f);
  }

  // Detect cycles
  if (hasCycle(graph)) {
    throw new Error('Circular reference detected in NuGet package files');
  }

  // Return dependent files with leaf information
  return Array.from(deps).map(([name, isLeaf]) => ({ name, isLeaf }));
}
```

**Update Strategy**:

- Discovers all related project files
- Builds dependency graph using `ProjectReference` elements
- Updates all dependent projects in a single operation
- Handles central package management

### 3. Pip-Compile Manager Reference

**Usage**:

```typescript
import { Graph, topologicalSort } from 'graph-data-structure';

export function sortPackageFiles(
  depsBetweenFiles: DependencyBetweenFiles[],
  packageFiles: Map<string, PackageFile>,
): PackageFile[] {
  const graph = new Graph();
  depsBetweenFiles.forEach(({ sourceFile, outputFile }) => {
    graph.addEdge(sourceFile, outputFile);
  });
  const sorted = topologicalSort(graph);
  // Process files in topological order
}
```

## Architecture Comparison

### Dependencies Management Differences

| Aspect                     | Go Modules                      | NuGet                                  | Key Differences                          |
| -------------------------- | ------------------------------- | -------------------------------------- | ---------------------------------------- |
| **Dependency Declaration** | `require` + `replace`           | `ProjectReference`                     | Go uses separate sections                |
| **Local References**       | `replace module => ../path`     | `<ProjectReference Include="../path">` | Both support relative paths              |
| **Indirect Dependencies**  | Managed by `go mod tidy`        | Handled by MSBuild                     | Go automatically manages transitive deps |
| **Lock Files**             | `go.sum` (cryptographic hashes) | `packages.lock.json`                   | Different formats and purposes           |
| **Update Commands**        | `go get` + `go mod tidy`        | `dotnet restore`                       | Different tooling                        |

### Key Architectural Differences

1. **Dependency Graph Awareness**:
   - **NuGet**: ✅ Builds full dependency graph
   - **Go**: ❌ Processes modules independently

2. **Local Reference Handling**:
   - **NuGet**: ✅ Actively processes `ProjectReference` elements
   - **Go**: ❌ Skips local `replace` directives

3. **Multi-Module Updates**:
   - **NuGet**: ✅ Updates all dependent projects together
   - **Go**: ❌ Updates one module at a time

4. **Cycle Detection**:
   - **NuGet**: ✅ Detects and prevents circular references
   - **Go**: ❌ No cycle detection (handled by Go tooling)

## Proposed Solution Architecture

### 1. New Module: `package-tree.ts`

Following the NuGet pattern, create a new module to handle dependency graphs:

```typescript
// lib/modules/manager/gomod/package-tree.ts
import { Graph, hasCycle } from 'graph-data-structure';
import { logger } from '../../../logger';
import { scm } from '../../platform/scm';

export interface GoModuleFile {
  name: string;
  isLeaf: boolean;
}

/**
 * Get all dependent go.mod files that need to be updated when packageFileName changes
 */
export async function getDependentGoModFiles(
  packageFileName: string,
): Promise<GoModuleFile[]> {
  const goModFiles = await getAllGoModFiles();
  const graph = new Graph();

  // Build graph from local replace directives
  for (const goModFile of goModFiles) {
    graph.addNode(goModFile);
  }

  for (const goModFile of goModFiles) {
    const replaceDirectives = await parseLocalReplaceDirectives(goModFile);

    for (const directive of replaceDirectives) {
      const referencedGoMod = directive.targetGoModPath;
      if (referencedGoMod) {
        graph.addEdge(referencedGoMod, goModFile);
      }
    }
  }

  // Detect cycles
  if (hasCycle(graph)) {
    logger.warn('Circular reference detected in Go modules replace directives');
    return [];
  }

  return buildDependentFiles(packageFileName, graph);
}

/**
 * Get all go.mod files in the repository
 */
async function getAllGoModFiles(): Promise<string[]> {
  const allFiles = await scm.getFileList();
  return allFiles.filter((file) => file.endsWith('go.mod'));
}
```

### 2. Conservative Artifacts Handler Enhancement

Only activate graph-aware updates when `gomodTidyAll` option is used:

```typescript
// lib/modules/manager/gomod/artifacts.ts
import { getDependentGoModFiles } from './package-tree';

export async function updateArtifacts({
  packageFileName: goModFileName,
  updatedDeps,
  newPackageFileContent: newGoModContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`gomod.updateArtifacts(${goModFileName})`);

  // EXISTING LOGIC UNCHANGED - all current behavior preserved
  const sumFileName = goModFileName.replace(regEx(/\.mod$/), '.sum');
  const existingGoSumContent = await readLocalFile(sumFileName);
  if (!existingGoSumContent) {
    logger.debug('No go.sum found');
    return null;
  }

  // ... ALL existing code continues unchanged until end of function ...

  // NEW: Only when gomodTidyAll is enabled - add before return res;
  if (config.postUpdateOptions?.includes('gomodTidyAll')) {
    const dependentResults = await updateDependentGoModFiles(
      goModFileName,
      execOptions,
      tidyOpts,
    );
    if (dependentResults.length > 0) {
      res.push(...dependentResults);
    }
  }

  return res;
}

/**
 * Update dependent go.mod files when gomodTidyAll is enabled
 */
async function updateDependentGoModFiles(
  packageFileName: string,
  execOptions: ExecOptions,
  tidyOpts: string,
): Promise<UpdateArtifactsResult[]> {
  const dependentFiles = await getDependentGoModFiles(packageFileName);
  const results: UpdateArtifactsResult[] = [];

  for (const file of dependentFiles) {
    const result = await tidyDependentModule(file.name, execOptions, tidyOpts);
    if (result) {
      results.push(...result);
    }
  }

  return results;
}
```

### 3. Post-Update Option Integration

Add `gomodTidyAll` to the existing post-update options pattern:

```typescript
// Following EXACT existing pattern from artifacts.ts
if (config.postUpdateOptions?.includes('gomodTidyAll')) {
  // New graph-aware logic here
}
```

### 4. Implementation Strategy

**Phase 1: Add New Post-Update Option**

- Add `gomodTidyAll` to existing post-update options pattern
- Follow existing code style from `gomodTidy`, `gomodVendor`, etc.
- No changes to existing logic - purely additive

**Phase 2: Basic Graph Building**

- Implement `getDependentGoModFiles()` function following NuGet pattern
- Parse local `replace` directives for dependency relationships
- Build dependency graph using existing `graph-data-structure` library
- Add cycle detection with graceful fallback

**Phase 3: Dependent Module Updates**

- Only activate when `gomodTidyAll` option is explicitly enabled
- Run `go mod tidy` in dependent modules after main update
- Collect all modified files (go.mod, go.sum) from all modules

### 5. Key Design Decisions

1. **Zero Impact on Existing Logic**: Current behavior completely unchanged
2. **Strict Coding Style**: Follow existing patterns from `gomodTidy`, `gomodVendor`
3. **Opt-in Only**: New feature only activates with `gomodTidyAll` option
4. **Reuse NuGet Architecture**: Copy proven `package-tree.ts` pattern exactly
5. **Graceful Fallback**: Warn on cycles, continue with single-module updates
6. **Small, Clean Code**: Minimal functions with clear separation of concerns

### 6. Existing Code Patterns to Follow

**Post-Update Options Pattern**:

```typescript
// Follow EXACT existing patterns from artifacts.ts
const useVendor =
  !!config.postUpdateOptions?.includes('gomodVendor') ||
  (!config.postUpdateOptions?.includes('gomodSkipVendor') &&
    (await readLocalFile(vendorModulesFileName)) !== null);

if (config.postUpdateOptions?.includes('gomodMassage')) {
  // existing logic
}

const isImportPathUpdateRequired =
  config.postUpdateOptions?.includes('gomodUpdateImportPaths') &&
  config.updateType === 'major';

const isGoModTidyRequired =
  !mustSkipGoModTidy &&
  (config.postUpdateOptions?.includes('gomodTidy') === true ||
    config.postUpdateOptions?.includes('gomodTidy1.17') === true ||
    config.postUpdateOptions?.includes('gomodTidyE') === true ||
    (config.updateType === 'major' && isImportPathUpdateRequired));

// NEW: Follow exact same pattern with lowercase naming
if (config.postUpdateOptions?.includes('gomodTidyAll')) {
  // new graph-aware logic here
}
```

**Function Naming**:

- `getDependentGoModFiles()` - follows `getDependentPackageFiles()` from NuGet
- `package-tree.ts` - matches NuGet naming convention exactly
- `gomodTidyAll` - follows lowercase pattern like `gomodTidy`, `gomodVendor`

**Error Handling**:

- Use `logger.warn()` for non-fatal issues (like cycles)
- Return empty arrays for graceful fallback
- Follow existing error patterns from NuGet

### 7. Testing Strategy

1. **Unit Tests**: Test `getDependentGoModFiles()` with various scenarios
2. **Integration Tests**: Test `gomodTidyAll` option with real go.mod files
3. **Regression Tests**: Ensure existing behavior unchanged
4. **Edge Cases**: Circular references, missing modules, invalid paths

## Implementation Checklist

- [ ] Create `package-tree.ts` module (copy NuGet pattern)
- [ ] Implement `getDependentGoModFiles()` function
- [ ] Parse local `replace` directives for dependency relationships
- [ ] Build dependency graph with cycle detection
- [ ] Add `gomodTidyAll` option to artifacts.ts (minimal change)
- [ ] Add comprehensive test coverage
- [ ] Update gomod/readme.md with new option
- [ ] Handle edge cases with graceful fallback

## Potential Risks and Mitigations

1. **Performance Impact**: Graph building might be slow for large monorepos
   - _Mitigation_: Implement caching and optimize file I/O

2. **Circular Dependencies**: Complex replace chains might create cycles
   - _Mitigation_: Use existing cycle detection from graph-data-structure

3. **Compatibility**: Changes might break existing workflows
   - _Mitigation_: Make feature opt-in initially, extensive testing

4. **Complexity**: Multi-module updates are more complex to debug
   - _Mitigation_: Enhanced logging and clear error messages

## Required Code Pattern Analysis

Before implementation, study these existing patterns:

1. **NuGet `package-tree.ts`**:
   - Function signatures and return types
   - Graph building approach
   - Error handling patterns
   - Documentation style

2. **gomod `artifacts.ts`**:
   - Post-update option checking pattern
   - ExecOptions usage
   - File modification detection
   - Result building pattern

3. **Other managers using `graph-data-structure`**:
   - pip-compile for topological sorting
   - NuGet for dependency graphs

## Conclusion

The proposed solution strictly follows existing Renovate patterns:

- **Conservative**: Zero impact on current logic
- **Consistent**: Uses established NuGet `package-tree.ts` pattern exactly
- **Compliant**: Follows maintainer's coding style and architecture
- **Clean**: Small, focused functions with clear separation of concerns
- **Safe**: Opt-in feature with graceful fallback handling

This approach ensures maintainer acceptance by respecting existing architecture while solving the monorepo dependency issue.
