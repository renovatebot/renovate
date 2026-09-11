import { codeBlock } from 'common-tags';
import upath from 'upath';
import { partial } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type {
  InternalGlobalConfigOptions,
  RepoGlobalConfig,
} from '../../../config/types.ts';
import { doAutoReplace } from '../../../workers/repository/update/branch/auto-replace.ts';
import type { BranchUpgradeConfig } from '../../../workers/types.ts';
import { extractPackageFile } from './index.ts';

vi.mock('../../../util/fs/index.ts');

const adminConfig: RepoGlobalConfig & InternalGlobalConfigOptions = {
  localDir: upath.resolve('/tmp/repo'),
};

describe('modules/manager/pants/integration', () => {
  beforeEach(() => {
    GlobalConfig.set(adminConfig);
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  it('updates each target that pins the same requirement', async () => {
    // Pinning one dist per resolve is ordinary in a Pants repository, so two
    // targets can hold the same requirement string. Each update has to land on
    // its own target.
    const buildFile = codeBlock`
      python_requirement(
          name="pytest-py311",
          requirements=["pytest>=9.0.0,<10.0.0"],
          resolve="py311",
      )

      python_requirement(
          name="pytest-py312",
          requirements=["pytest>=9.0.0,<10.0.0"],
          resolve="py312",
      )
    `;

    const extracted = await extractPackageFile(buildFile, 'BUILD.pants');
    expect(extracted!.deps).toHaveLength(2);

    for (const depIndex of [0, 1]) {
      const dep = extracted!.deps[depIndex];
      const upgrade = partial<BranchUpgradeConfig>({
        manager: 'pants',
        packageFile: 'BUILD.pants',
        depName: dep.depName,
        currentValue: dep.currentValue ?? undefined,
        replaceString: dep.replaceString,
        newValue: '>=9.1.0,<10.0.0',
        depIndex,
      });

      const updated = await doAutoReplace(upgrade, buildFile, false);

      const updatedLines = updated!
        .split('\n')
        .filter((line) => line.includes('pytest>='));
      expect(updatedLines).toHaveLength(2);
      // Only the target at this index moved.
      expect(updatedLines[depIndex]).toContain('>=9.1.0,<10.0.0');
      expect(updatedLines[1 - depIndex]).toContain('>=9.0.0,<10.0.0');
      // Per line rather than per file, because the sibling target legitimately
      // still carries the old range. Without this the multi-target case -- the
      // one where an insertion is most plausible -- passes on a line holding
      // both, since the confirmation compares only name and version and the
      // sibling check is satisfied too.
      expect(updatedLines[depIndex]).not.toContain('>=9.0.0,<10.0.0');
    }
  });

  it('updates a requirement written as adjacent string literals', async () => {
    // The joined text appears nowhere in the file, so the replacement has to
    // land on the literal that carries the version.
    const buildFile = codeBlock`
      python_requirement(
          name="joined",
          requirements=[
              "sqlparse"
              ">=0.4.0,<0.5.0",
          ],
      )
    `;

    const extracted = await extractPackageFile(buildFile, 'BUILD.pants');
    const dep = extracted!.deps[0];
    expect(dep).toMatchObject({
      depName: 'sqlparse',
      currentValue: '>=0.4.0,<0.5.0',
    });
    expect(dep.replaceString).toBeUndefined();

    const updated = await doAutoReplace(
      partial<BranchUpgradeConfig>({
        manager: 'pants',
        packageFile: 'BUILD.pants',
        depName: dep.depName,
        currentValue: dep.currentValue ?? undefined,
        replaceString: dep.replaceString,
        newValue: '>=0.5.0,<0.6.0',
        depIndex: 0,
      }),
      buildFile,
      false,
    );

    expect(updated).toContain('">=0.5.0,<0.6.0"');
    expect(updated).toContain('"sqlparse"');
    // The confirmation inspects only `deps[depIndex]`, comparing name and
    // version -- it cannot tell a replacement from an insertion that puts a
    // well-formed requirement in front of the old one. Without this the test
    // passes on a file holding both versions.
    expect(updated).not.toContain('">=0.4.0,<0.5.0"');
  });

  it('walks past an earlier occurrence of a version it replaces alone', async () => {
    // A requirement written as adjacent literals has no text to anchor on, so
    // the version alone is replaced. Where that text appears earlier in the
    // file, the first attempt fails its own confirmation and the scan moves on,
    // which is what keeps the edit on the right line.
    const buildFile = codeBlock`
      python_requirement(
          name="pinned",
          requirements=["decoy==1.0.0"],
      )

      python_requirement(
          name="split",
          requirements=[
              "sqlparse"
              "==1.0.0",
          ],
      )
    `;

    const extracted = await extractPackageFile(buildFile, 'BUILD.pants');
    const dep = extracted!.deps[1];
    expect(dep.depName).toBe('sqlparse');
    expect(dep.replaceString).toBeUndefined();

    const updated = await doAutoReplace(
      partial<BranchUpgradeConfig>({
        manager: 'pants',
        packageFile: 'BUILD.pants',
        depName: dep.depName,
        currentValue: dep.currentValue ?? undefined,
        replaceString: dep.replaceString,
        newValue: '==2.0.0',
        depIndex: 1,
      }),
      buildFile,
      false,
    );

    expect(updated).toContain('"decoy==1.0.0"');
    expect(updated).toContain('"==2.0.0"');
  });

  it('updates the requirement extraction found, not the one the content suggests', async () => {
    // A generator source holding a line that parses as a target. Nothing about
    // the name says which it is and the content says the wrong thing, so the
    // reading extraction recorded is the only thing that routes it.
    const source = codeBlock`
      tomli==2.0.1
      python_requirement(requirements=["decoy==9.9.9"])
    `;
    const config = {
      packageFile: 'deps/constraints',
      managerData: { pantsReadAs: 'source' },
    };

    const extracted = await extractPackageFile(
      source,
      'deps/constraints',
      config,
    );
    expect(extracted!.deps).toMatchObject([{ depName: 'tomli' }]);

    const dep = extracted!.deps[0];
    const updated = await doAutoReplace(
      partial<BranchUpgradeConfig>({
        manager: 'pants',
        packageFile: config.packageFile,
        depName: dep.depName,
        currentValue: dep.currentValue ?? undefined,
        replaceString: dep.replaceString,
        // The field this test exists for.
        managerData: dep.managerData,
        newValue: '==3.0.0',
        depIndex: 0,
      }),
      source,
      false,
    );

    expect(updated).toContain('tomli==3.0.0');
    expect(updated).not.toContain('tomli==2.0.1');
    // The decoy line is load-bearing as content -- it is what the wrong reading
    // would extract -- but asserting it survives is not: this dependency comes
    // from pip_requirements, which sets no replaceString, so the confirmation
    // anchors on `currentValue` and cannot reach the decoy's version at all.
    // What fails when the record is ignored is the extraction above.
    expect(updated).toContain('decoy==9.9.9');
  });

  it('updates a build file that carries a source file extension', async () => {
    // The routing asks the extensions only a generator source carries before it
    // asks the content, so this file never reaches the content branch: without
    // the recorded reading the confirmation reads it as a requirements file,
    // finds no `click` line in it, and the update fails. That makes this the
    // shape where the recorded 'buildFile' is load-bearing, and it was the arm
    // no test could see -- honouring only the 'source' arm passed every test in
    // the branch.
    const buildFile = codeBlock`
      python_requirement(requirements=["click==8.1.7"])
    `;
    const config = {
      packageFile: 'pants_targets.txt',
      managerData: { pantsReadAs: 'buildFile' },
    };

    const extracted = await extractPackageFile(
      buildFile,
      'pants_targets.txt',
      config,
    );
    expect(extracted!.deps).toMatchObject([
      { depName: 'click', managerData: { pantsReadAs: 'buildFile' } },
    ]);

    const dep = extracted!.deps[0];
    const updated = await doAutoReplace(
      partial<BranchUpgradeConfig>({
        manager: 'pants',
        packageFile: config.packageFile,
        depName: dep.depName,
        currentValue: dep.currentValue ?? undefined,
        replaceString: dep.replaceString,
        managerData: dep.managerData,
        newValue: '==8.2.0',
        depIndex: 0,
      }),
      buildFile,
      false,
    );

    expect(updated).toContain('click==8.2.0');
    expect(updated).not.toContain('click==8.1.7');
  });

  it('updates a requirement in a build file whose name is not BUILD', async () => {
    const buildFile = codeBlock`
      python_requirement(requirements=["click==8.1.7"])
    `;

    const extracted = await extractPackageFile(buildFile, 'pants_targets.py');
    const dep = extracted!.deps[0];
    const upgrade = partial<BranchUpgradeConfig>({
      manager: 'pants',
      packageFile: 'pants_targets.py',
      depName: dep.depName,
      currentValue: dep.currentValue ?? undefined,
      replaceString: dep.replaceString,
      managerData: dep.managerData,
      newValue: '==8.2.0',
      depIndex: 0,
    });

    const updated = await doAutoReplace(upgrade, buildFile, false);
    expect(updated).toContain('click==8.2.0');
    expect(updated).not.toContain('click==8.1.7');
  });
});
