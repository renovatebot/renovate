import { codeBlock } from 'common-tags';
import { fs } from '../../../../test/util.ts';
import { extractAllPackageFiles, extractPackageFile } from './index.ts';

vi.mock('../../../util/fs/index.ts');

const buildFile = codeBlock`
  python_requirement(
      name="pytest-mock",
      requirements=["pytest-mock>=3.12,<4"],
      resolve=parametrize("py311"),
  )

  # A comment between targets, and a pin with a reason.
  python_requirement(
      name="pinned",
      requirements=[
          "fancycompleter<=0.10.0",
          "requests[security]==2.31.0",
      ],
  )

  python_requirement(
      name="no-version",
      requirements=["types-protobuf"],
  )

  python_requirements(
      name="app",
      source="app-requirements.txt",
      resolve="app",
      module_mapping={
          "fpdf2": ["fpdf"],
          "pillow": ["PIL"],
      },
      overrides={
          "fastapi": {
              "dependencies": [
                  ":app#orjson",
              ],
          },
      },
  )

  python_requirements(
      name="default-source",
  )

  python_sources(
      name="lib",
  )
`;

function mockFiles(files: Record<string, string>): void {
  fs.getSiblingFileName.mockImplementation(
    (existingFileNameWithPath: string, otherFileName: string) =>
      existingFileNameWithPath
        .slice(0, existingFileNameWithPath.lastIndexOf('/') + 1)
        .concat(otherFileName),
  );
  fs.readLocalFile.mockImplementation(
    (fileName: string): Promise<any> => Promise.resolve(files[fileName]),
  );
}

describe('modules/manager/pants/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for a build file without requirements', async () => {
      const content = codeBlock`
        python_sources(name="lib")
        python_requirements(name="reqs", source="requirements.txt")
      `;
      expect(await extractPackageFile(content, 'BUILD.pants')).toBeNull();
    });

    it('returns null for unparseable content', async () => {
      expect(
        await extractPackageFile('!!! not python', 'BUILD.pants'),
      ).toBeNull();
    });

    it('extracts python_requirement targets', async () => {
      const res = await extractPackageFile(buildFile, 'BUILD.pants');
      expect(res).toEqual({
        deps: [
          {
            datasource: 'pypi',
            depName: 'pytest-mock',
            packageName: 'pytest-mock',
            currentValue: '>=3.12,<4',
            depType: 'python_requirement',
            replaceString: 'pytest-mock>=3.12,<4',
          },
          {
            datasource: 'pypi',
            depName: 'fancycompleter',
            packageName: 'fancycompleter',
            currentValue: '<=0.10.0',
            depType: 'python_requirement',
            replaceString: 'fancycompleter<=0.10.0',
          },
          {
            datasource: 'pypi',
            depName: 'requests',
            packageName: 'requests',
            currentValue: '==2.31.0',
            currentVersion: '2.31.0',
            depType: 'python_requirement',
            replaceString: 'requests[security]==2.31.0',
          },
          {
            datasource: 'pypi',
            depName: 'types-protobuf',
            packageName: 'types-protobuf',
            currentValue: undefined,
            depType: 'python_requirement',
            replaceString: 'types-protobuf',
          },
        ],
      });
    });

    it('handles the plain BUILD file name', async () => {
      const content = codeBlock`
        python_requirement(requirements=["click==8.1.7"])
      `;
      expect((await extractPackageFile(content, 'BUILD'))?.deps).toMatchObject([
        { depName: 'click', depType: 'python_requirement' },
      ]);
    });

    it('ignores strings outside the supported fields', async () => {
      const content = codeBlock`
        python_requirements(
            name="reqs",
            source="reqs.txt",
            module_mapping={"pillow": ["PIL"]},
            overrides={"fastapi": {"dependencies": ["orjson==3.9.0"]}},
        )
      `;
      expect(await extractPackageFile(content, 'BUILD.pants')).toBeNull();
    });

    it('skips requirements it cannot parse', async () => {
      const content = codeBlock`
        python_requirement(
            requirements=["==1.2.3", "click==8.1.7"],
        )
      `;
      expect(
        (await extractPackageFile(content, 'BUILD.pants'))?.deps,
      ).toMatchObject([{ depName: 'click' }]);
    });

    it('extracts VCS requirements', async () => {
      const content = codeBlock`
        python_requirement(
            requirements=["some-package @ git+https://github.com/foo/bar@v1.2.3"],
        )
      `;
      expect((await extractPackageFile(content, 'BUILD.pants'))?.deps).toEqual([
        {
          datasource: 'git-tags',
          depName: 'bar',
          packageName: 'https://github.com/foo/bar',
          currentValue: 'v1.2.3',
          currentVersion: 'v1.2.3',
          depType: 'python_requirement',
          replaceString: 'some-package @ git+https://github.com/foo/bar@v1.2.3',
        },
      ]);
    });

    it('parses a pyproject.toml source as PEP 621', async () => {
      const content = codeBlock`
        [project]
        name = "my-package"
        dependencies = ["typing-extensions>=4.8.0,<5.0.0"]
      `;
      const res = await extractPackageFile(content, 'pyproject.toml');
      expect(res?.deps).toMatchObject([
        { depName: 'typing-extensions', currentValue: '>=4.8.0,<5.0.0' },
      ]);
    });

    it('parses a requirements file as such', async () => {
      const res = await extractPackageFile(
        'click==8.1.7\n',
        'requirements.txt',
      );
      expect(res?.deps).toMatchObject([
        { depName: 'click', currentValue: '==8.1.7' },
      ]);
    });
  });

  describe('extractAllPackageFiles()', () => {
    it('returns build file deps and the referenced source files', async () => {
      mockFiles({
        'BUILD.pants': buildFile,
        'app-requirements.txt': 'fastapi==0.110.0\norjson>=3\n',
        'requirements.txt': 'click==8.1.7\n',
      });

      const res = await extractAllPackageFiles({}, ['BUILD.pants']);
      expect(res).toMatchObject([
        {
          packageFile: 'BUILD.pants',
          deps: [
            { depName: 'pytest-mock' },
            { depName: 'fancycompleter' },
            { depName: 'requests' },
            { depName: 'types-protobuf' },
          ],
        },
        {
          packageFile: 'app-requirements.txt',
          deps: [
            { depName: 'fastapi', depType: 'python_requirements' },
            { depName: 'orjson', depType: 'python_requirements' },
          ],
        },
        {
          packageFile: 'requirements.txt',
          deps: [{ depName: 'click', depType: 'python_requirements' }],
        },
      ]);
    });

    it('extracts a pyproject.toml source', async () => {
      mockFiles({
        'pkg/BUILD.pants':
          'python_requirements(name="reqs", source="pyproject.toml")\n',
        'pkg/pyproject.toml': codeBlock`
          [project]
          name = "my-package"
          requires-python = ">=3.12,<3.13"
          dependencies = ["typing-extensions>=4.8.0,<5.0.0"]
        `,
      });

      const res = await extractAllPackageFiles({}, ['pkg/BUILD.pants']);
      expect(res).toMatchObject([
        {
          packageFile: 'pkg/pyproject.toml',
          deps: [
            { packageName: 'python', currentValue: '>=3.12,<3.13' },
            {
              depName: 'typing-extensions',
              depType: 'project.dependencies',
            },
          ],
        },
      ]);
    });

    it('extracts a shared source file once', async () => {
      mockFiles({
        'BUILD.pants': 'python_requirements(name="reqs")\n',
        'requirements.txt': 'click==8.1.7\n',
      });

      const res = await extractAllPackageFiles({}, [
        'BUILD.pants',
        'BUILD.pants',
      ]);
      expect(
        res.filter((f) => f.packageFile === 'requirements.txt'),
      ).toHaveLength(1);
    });

    it('skips missing build files', async () => {
      mockFiles({});
      expect(await extractAllPackageFiles({}, ['missing/BUILD.pants'])).toEqual(
        [],
      );
    });

    it('skips a source file with no deps', async () => {
      mockFiles({
        'BUILD.pants': 'python_requirements(name="reqs")\n',
        'requirements.txt': '# nothing here\n',
      });
      expect(await extractAllPackageFiles({}, ['BUILD.pants'])).toEqual([]);
    });

    it('skips a missing python_requirements source', async () => {
      mockFiles({
        'BUILD.pants': 'python_requirements(name="reqs", source="nope.txt")\n',
      });
      expect(await extractAllPackageFiles({}, ['BUILD.pants'])).toEqual([]);
    });
  });
});
