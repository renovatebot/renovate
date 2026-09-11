import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'python_requirement',
    description: 'Written in the build file itself',
  },
  {
    depType: 'python_requirements',
    description:
      'Read from the file a `python_requirements` target names, when that file gives it no type of its own',
  },
] as const satisfies readonly DepTypeMetadata[];

// `poetry_requirements` and `uv_requirements` are not listed, though the same
// fallback could produce them: both read their source as TOML, and a TOML source
// whose dependencies have no type of their own is one Pants rejects. Listing
// them would send someone writing `matchDepTypes` after a value that never
// matches. What those sources do produce is described below.

export const supportsDynamicDepTypesNote =
  'A dependency read from a source file keeps the `depType` that the format of that file gives it, so `matchDepTypes` has to name that rather than the target that pointed at the file. A Poetry source gives a dependency its group name, `dependencies` for the main group and the group name for any other. A PEP 621 or uv source gives `project.dependencies`, `dependency-groups`, `tool.uv.dev-dependencies`, or `requires-python` for the interpreter constraint.';
