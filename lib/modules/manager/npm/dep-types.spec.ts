import {
  isDevEnginesDepType,
  isPackageManagerDepType,
  isToolDepType,
} from './dep-types.ts';

describe('modules/manager/npm/dep-types', () => {
  it.each`
    depType                        | packageManager | devEngines | tool
    ${'engines'}                   | ${false}       | ${false}   | ${true}
    ${'packageManager'}            | ${true}        | ${false}   | ${true}
    ${'devEngines.runtime'}        | ${false}       | ${true}    | ${true}
    ${'devEngines.packageManager'} | ${true}        | ${true}    | ${true}
    ${'dependencies'}              | ${false}       | ${false}   | ${false}
    ${'volta'}                     | ${false}       | ${false}   | ${false}
    ${undefined}                   | ${false}       | ${false}   | ${false}
  `('classifies $depType', ({ depType, packageManager, devEngines, tool }) => {
    expect(isPackageManagerDepType(depType)).toBe(packageManager);
    expect(isDevEnginesDepType(depType)).toBe(devEngines);
    expect(isToolDepType(depType)).toBe(tool);
  });
});
