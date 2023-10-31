import { codeBlock } from 'common-tags';
import type { UpdateLockedConfig } from '../../types';
import { updateLockedDependency } from './update-locked';
import * as utilFns from './util';

const lockFile = 'terraform.hcl';

const lockFileContent = codeBlock`
  provider "registry.terraform.io/hashicorp/aws" {
    version     = "3.0.0"
    constraints = "3.0.0"
    hashes = [
      "foo",
    ]
  }

  provider "registry.terraform.io/hashicorp/azurerm" {
    version     = "2.50.0"
    constraints = "~> 2.50"
    hashes = [
      "bar",
    ]
  }

  provider "registry.terraform.io/hashicorp/random" {
    version     = "2.2.1"
    constraints = "~> 2.2"
    hashes = [
      "baz",
    ]
  }
`;

describe('modules/manager/terraform/lockfile/update-locked', () => {
  it('detects already updated', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'main.tf',
      lockFile,
      lockFileContent,
      depName: 'hashicorp/aws',
      newVersion: '3.0.0',
      currentVersion: '3.0.0',
    };
    expect(updateLockedDependency(config).status).toBe('already-updated');
  });

  it('returns unsupported if dependency is undefined', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'main.tf',
      lockFile,
      lockFileContent,
      depName: undefined as never,
      newVersion: '3.1.0',
      currentVersion: '3.0.0',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });

  it('returns unsupported if lockfileContent is undefined', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'main.tf',
      lockFile,
      depName: 'hashicorp/not-there',
      newVersion: '3.1.0',
      currentVersion: '3.0.0',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });

  it('returns unsupported', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'main.tf',
      lockFile,
      lockFileContent,
      depName: 'hashicorp/aws',
      newVersion: '3.1.0',
      currentVersion: '3.0.0',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });

  it('returns update-failed for errors', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'main.tf',
      lockFile,
      lockFileContent,
      depName: 'hashicorp/aws',
      newVersion: '3.1.0',
      currentVersion: '3.0.0',
    };
    jest
      .spyOn(utilFns, 'extractLocks')
      .mockReturnValueOnce(new Error() as never);
    expect(updateLockedDependency(config).status).toBe('update-failed');
  });
});
