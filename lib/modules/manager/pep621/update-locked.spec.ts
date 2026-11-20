import { codeBlock } from 'common-tags';
import type { UpdateLockedConfig } from '../types.ts';
import { updateLockedDependency } from './index.ts';

const packageFile = 'pyproject.toml';
const lockFile = 'uv.lock';

const lockFileContent = codeBlock`
  version = 1
  requires-python = ">=3.11"
  resolution-markers = [
      "python_full_version >= '3.12'",
      "python_full_version < '3.12'",
  ]

  [[package]]
  name = "attrs"
  version = "23.2.0"
  source = { registry = "https://pypi.org/simple" }

  [[package]]
  name = "numpy"
  version = "2.2.6"
  source = { registry = "https://pypi.org/simple" }
  resolution-markers = ["python_full_version < '3.12'"]

  [[package]]
  name = "numpy"
  version = "2.3.1"
  source = { registry = "https://pypi.org/simple" }
  resolution-markers = ["python_full_version >= '3.12'"]
`;

describe('modules/manager/pep621/update-locked', () => {
  it('detects already updated', () => {
    const config: UpdateLockedConfig = {
      packageFile,
      lockFile,
      lockFileContent,
      depName: 'attrs',
      newVersion: '23.2.0',
      currentVersion: '23.1.0',
    };
    expect(updateLockedDependency(config).status).toBe('already-updated');
  });

  it('detects already updated for a lock file in a subdirectory', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'sub/pyproject.toml',
      lockFile: 'sub/uv.lock',
      lockFileContent,
      depName: 'Attrs',
      newVersion: '23.2.0',
      currentVersion: '23.1.0',
    };
    expect(updateLockedDependency(config).status).toBe('already-updated');
  });

  it('returns unsupported for another locked version', () => {
    const config: UpdateLockedConfig = {
      packageFile,
      lockFile,
      lockFileContent,
      depName: 'attrs',
      newVersion: '24.1.0',
      currentVersion: '23.1.0',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });

  it('returns unsupported for a package locked more than once', () => {
    const config: UpdateLockedConfig = {
      packageFile,
      lockFile,
      lockFileContent,
      depName: 'numpy',
      newVersion: '2.2.6',
      currentVersion: '2.2.5',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });

  it('returns unsupported for a package which is not locked', () => {
    const config: UpdateLockedConfig = {
      packageFile,
      lockFile,
      lockFileContent,
      depName: 'requests',
      newVersion: '2.32.3',
      currentVersion: '2.32.2',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });

  it('returns unsupported for missing lock file content', () => {
    const config: UpdateLockedConfig = {
      packageFile,
      lockFile,
      depName: 'attrs',
      newVersion: '23.2.0',
      currentVersion: '23.1.0',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });

  it('returns unsupported for an invalid lock file', () => {
    const config: UpdateLockedConfig = {
      packageFile,
      lockFile,
      lockFileContent: 'not [ toml',
      depName: 'attrs',
      newVersion: '23.2.0',
      currentVersion: '23.1.0',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });

  it('returns unsupported for a pdm lock file', () => {
    const config: UpdateLockedConfig = {
      packageFile,
      lockFile: 'pdm.lock',
      lockFileContent: codeBlock`
        [[package]]
        name = "attrs"
        version = "23.2.0"
      `,
      depName: 'attrs',
      newVersion: '23.2.0',
      currentVersion: '23.1.0',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });

  it('returns unsupported for a pixi lock file', () => {
    const config: UpdateLockedConfig = {
      packageFile,
      lockFile: 'pixi.lock',
      lockFileContent,
      depName: 'attrs',
      newVersion: '23.2.0',
      currentVersion: '23.1.0',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });

  it('returns unsupported without a lock file', () => {
    const config: UpdateLockedConfig = {
      packageFile,
      lockFile: '',
      depName: 'attrs',
      newVersion: '23.2.0',
      currentVersion: '23.1.0',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });
});
