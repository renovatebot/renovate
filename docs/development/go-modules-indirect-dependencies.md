# Solution for GitHub Issue #12999: Indirect dependencies in dependent go modules need to be updated

## Problem Statement

In Go monorepos with local replace directives, when Renovate updates a module, it doesn't update dependent modules that have replace directives pointing to the updated module. This causes test failures because the dependent modules have stale indirect dependencies.

### Example Scenario

```
monorepo/
├── a/
│   ├── go.mod  (has dependency that gets updated)
│   └── go.sum
└── b/
    ├── go.mod  (has "replace monorepo/a => ../a")
    └── go.sum  (contains indirect dependencies from a)
```

**Current Behavior:**
- Renovate updates `monorepo/a/go.mod` and `monorepo/a/go.sum`
- `monorepo/b/go.mod` and `monorepo/b/go.sum` remain unchanged
- Tests fail because `monorepo/b` has stale indirect dependencies

**Desired Behavior:**
- Renovate updates `monorepo/a/go.mod` and `monorepo/a/go.sum`
- Renovate detects that `monorepo/b` depends on `monorepo/a` via replace directive
- Renovate runs `go mod tidy` in `monorepo/b`
- All changes are included in the same PR

## Solution Architecture

### 1. Dependency Graph Building

The solution builds a dependency graph by:

1. **Parsing go.mod files** to extract replace directives
2. **Identifying local dependencies** (paths starting with `./`, `../`, or `/`)
3. **Building dependency relationships** between modules
4. **Creating a graph** that maps which modules depend on which other modules

### 2. Enhanced Artifacts Update Process

When a Go module is updated:

1. **Run original update logic** (update the primary module)
2. **Build dependency graph** for the repository
3. **Find dependent modules** that have replace directives pointing to the updated module
4. **Update dependent modules** by running `go mod tidy` on each one
5. **Include all changes** in the same PR

### 3. Integration Points

The solution integrates with Renovate's existing architecture:

- **Extraction Phase**: Enhanced to build dependency relationships
- **Update Phase**: Modified to propagate updates to dependent modules
- **Worker Phase**: Updated to handle multiple module updates in a single PR

## Implementation Details

### Core Components

#### 1. `dependency-graph.ts`
- Builds dependency graph from go.mod files
- Extracts replace directives
- Identifies local dependency relationships
- Provides utilities to find dependent modules

#### 2. `dependent-modules.ts`
- Updates dependent modules when a module is updated
- Runs `go mod tidy` on dependent modules
- Captures updated go.mod and go.sum files
- Handles errors gracefully

#### 3. Enhanced `artifacts.ts`
- Integrates dependent module updates into existing update process
- Maintains backward compatibility
- Ensures all updates are included in the same PR

### Key Features

1. **Automatic Detection**: Automatically detects dependent modules via replace directives
2. **Error Handling**: Graceful error handling to prevent breaking existing functionality
3. **Backward Compatibility**: Doesn't break existing Renovate functionality
4. **Performance**: Efficient dependency graph building and caching
5. **Logging**: Comprehensive logging for debugging and monitoring

## Usage

### For Renovate Contributors

1. **Replace the original `updateArtifacts` export** with `updateArtifactsWithDependents`
2. **Add the new files** to the gomod manager
3. **Update tests** to cover the new functionality
4. **Add configuration options** if needed

### For Users

No configuration changes needed! The solution works automatically:

```json
{
  "extends": ["config:base"],
  "postUpdateOptions": ["gomodTidy"]
}
```

## Testing Strategy

### Unit Tests

1. **Dependency Graph Building**
   - Test parsing of replace directives
   - Test local path resolution
   - Test dependency relationship building

2. **Dependent Module Updates**
   - Test `go mod tidy` execution
   - Test file modification detection
   - Test error handling

3. **Integration Tests**
   - Test end-to-end workflow
   - Test with real monorepo scenarios
   - Test backward compatibility

### Test Scenarios

1. **Simple Monorepo**
   ```
   a/go.mod: replace b => ../b
   b/go.mod: (updated dependency)
   ```

2. **Complex Monorepo**
   ```
   a/go.mod: replace b => ../b, replace c => ../c
   b/go.mod: replace c => ../c
   c/go.mod: (updated dependency)
   ```

3. **No Dependencies**
   ```
   a/go.mod: (updated dependency, no replace directives)
   ```

## Benefits

1. **Fixes Test Failures**: Dependent modules are automatically updated
2. **Maintains Consistency**: All related modules are updated together
3. **Reduces Manual Work**: No need for manual intervention
4. **Improves Reliability**: Ensures all dependencies are in sync
5. **Backward Compatible**: Doesn't break existing functionality

## Risks and Mitigation

### Risks

1. **Performance Impact**: Building dependency graph adds overhead
2. **Error Propagation**: Failures in dependent modules could affect primary updates
3. **Complexity**: Adds complexity to the update process

### Mitigation

1. **Caching**: Cache dependency graph to reduce overhead
2. **Graceful Degradation**: Continue with primary update even if dependent updates fail
3. **Comprehensive Testing**: Extensive testing to ensure reliability
4. **Configuration Options**: Allow users to disable the feature if needed

## Future Enhancements

1. **Workspace Support**: Support for Go workspaces
2. **Circular Dependency Detection**: Detect and handle circular dependencies
3. **Selective Updates**: Allow users to specify which dependent modules to update
4. **Performance Optimization**: Further optimize dependency graph building
5. **Monitoring**: Add metrics to track the feature's usage and effectiveness

## Conclusion

This solution addresses GitHub Issue #12999 by automatically detecting and updating dependent Go modules when their dependencies are updated. The implementation is robust, backward-compatible, and follows Renovate's existing patterns and architecture.

The solution ensures that all related modules in a monorepo are kept in sync, preventing test failures and maintaining consistency across the codebase.
