import { mocked } from '../../../../../test/util';
import { getLockedVersions } from './locked-versions';
import * as _pnpm from './pnpm';

const pnpm = mocked(_pnpm);
jest.mock('./pnpm');

describe('modules/manager/pnpm/extract/locked-versions', () => {
  it('uses pnpm-lock', async () => {
    pnpm.getPnpmLock.mockResolvedValue({
      lockedVersionsWithPath: {
        '.': {
          dependencies: {
            a: '1.0.0',
            b: '2.0.0',
            c: '3.0.0',
          },
        },
      },
      lockfileVersion: 6.0,
    });
    const packageFiles = [
      {
        managerData: {
          pnpmShrinkwrap: 'pnpm-lock.yaml',
        },
        extractedConstraints: {
          pnpm: '>=6.0.0',
        },
        deps: [
          {
            depName: 'a',
            depType: 'dependencies',
            currentValue: '1.0.0',
          },
          {
            depName: 'b',
            depType: 'dependencies',
            currentValue: '2.0.0',
          },
        ],
        packageFile: 'package.json',
      },
    ];
    await getLockedVersions(packageFiles);
    expect(packageFiles).toEqual([
      {
        extractedConstraints: { pnpm: '>=6.0.0' },
        deps: [
          {
            currentValue: '1.0.0',
            depName: 'a',
            lockedVersion: '1.0.0',
            depType: 'dependencies',
          },
          {
            currentValue: '2.0.0',
            depName: 'b',
            lockedVersion: '2.0.0',
            depType: 'dependencies',
          },
        ],
        lockFiles: ['pnpm-lock.yaml'],
        managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
        packageFile: 'package.json',
      },
    ]);
  });

  it('uses pnpm-lock in subfolder', async () => {
    pnpm.getPnpmLock.mockResolvedValue({
      lockedVersionsWithPath: {
        '.': {
          dependencies: {
            a: '1.0.0',
            b: '2.0.0',
            c: '3.0.0',
          },
        },
      },
      lockfileVersion: 6.0,
    });
    const packageFiles = [
      {
        managerData: {
          pnpmShrinkwrap: 'subfolder/pnpm-lock.yaml',
        },
        extractedConstraints: {
          pnpm: '>=6.0.0',
        },
        deps: [
          {
            depName: 'a',
            depType: 'dependencies',
            currentValue: '1.0.0',
          },
          {
            depName: 'b',
            depType: 'dependencies',
            currentValue: '2.0.0',
          },
        ],
        packageFile: 'subfolder/package.json',
      },
    ];
    await getLockedVersions(packageFiles);
    expect(packageFiles).toEqual([
      {
        extractedConstraints: { pnpm: '>=6.0.0' },
        deps: [
          {
            currentValue: '1.0.0',
            depName: 'a',
            lockedVersion: '1.0.0',
            depType: 'dependencies',
          },
          {
            currentValue: '2.0.0',
            depName: 'b',
            lockedVersion: '2.0.0',
            depType: 'dependencies',
          },
        ],
        lockFiles: ['subfolder/pnpm-lock.yaml'],
        managerData: { pnpmShrinkwrap: 'subfolder/pnpm-lock.yaml' },
        packageFile: 'subfolder/package.json',
      },
    ]);
  });

  it('uses pnpm-lock with workspaces', async () => {
    pnpm.getPnpmLock.mockResolvedValue({
      lockedVersionsWithPath: {
        'workspace-package': {
          dependencies: {
            a: '1.0.0',
            b: '2.0.0',
            c: '3.0.0',
          },
        },
      },
      lockfileVersion: 6.0,
    });
    const packageFiles = [
      {
        managerData: {
          pnpmShrinkwrap: 'subfolder/pnpm-lock.yaml',
        },
        extractedConstraints: {
          pnpm: '>=6.0.0',
        },
        deps: [],
        packageFile: 'subfolder/package.json',
      },
      {
        managerData: {
          pnpmShrinkwrap: 'subfolder/pnpm-lock.yaml',
        },
        extractedConstraints: {
          pnpm: '>=6.0.0',
        },
        deps: [
          {
            depName: 'a',
            depType: 'dependencies',
            currentValue: '1.0.0',
          },
          {
            depName: 'b',
            depType: 'dependencies',
            currentValue: '2.0.0',
          },
        ],
        packageFile: 'subfolder/workspace-package/package.json',
      },
    ];
    await getLockedVersions(packageFiles);
    expect(packageFiles).toEqual([
      {
        extractedConstraints: { pnpm: '>=6.0.0' },
        deps: [],
        lockFiles: ['subfolder/pnpm-lock.yaml'],
        managerData: { pnpmShrinkwrap: 'subfolder/pnpm-lock.yaml' },
        packageFile: 'subfolder/package.json',
      },
      {
        extractedConstraints: { pnpm: '>=6.0.0' },
        deps: [
          {
            currentValue: '1.0.0',
            depName: 'a',
            lockedVersion: '1.0.0',
            depType: 'dependencies',
          },
          {
            currentValue: '2.0.0',
            depName: 'b',
            lockedVersion: '2.0.0',
            depType: 'dependencies',
          },
        ],
        lockFiles: ['subfolder/pnpm-lock.yaml'],
        managerData: { pnpmShrinkwrap: 'subfolder/pnpm-lock.yaml' },
        packageFile: 'subfolder/workspace-package/package.json',
      },
    ]);
  });
});
