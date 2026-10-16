import { codeBlock } from 'common-tags';
import { fs, logger } from '../../../../test/util.ts';
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
            managerData: { pantsReadAs: 'buildFile' },
          },
          {
            datasource: 'pypi',
            depName: 'fancycompleter',
            packageName: 'fancycompleter',
            currentValue: '<=0.10.0',
            depType: 'python_requirement',
            replaceString: 'fancycompleter<=0.10.0',
            managerData: { pantsReadAs: 'buildFile' },
          },
          {
            datasource: 'pypi',
            depName: 'requests',
            packageName: 'requests',
            currentValue: '==2.31.0',
            currentVersion: '2.31.0',
            depType: 'python_requirement',
            replaceString: 'requests[security]==2.31.0',
            managerData: { pantsReadAs: 'buildFile' },
          },
          {
            datasource: 'pypi',
            depName: 'types-protobuf',
            packageName: 'types-protobuf',
            currentValue: undefined,
            depType: 'python_requirement',
            replaceString: 'types-protobuf',
            managerData: { pantsReadAs: 'buildFile' },
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

    it('reads a build file whose name is not BUILD', async () => {
      // `build_patterns` in pants.toml allows any name, and this path is also
      // the auto-replace confirmation, so a miss here fails every update.
      const content = codeBlock`
        python_requirement(requirements=["click==8.1.7"])
      `;
      expect(
        (await extractPackageFile(content, 'pants_targets.py'))?.deps,
      ).toMatchObject([{ depName: 'click', depType: 'python_requirement' }]);
    });

    it('returns null for a build file that declares no requirements', async () => {
      const content = codeBlock`
        python_sources(name="lib")
        python_requirements(name="reqs")
      `;
      expect(await extractPackageFile(content, 'BUILD')).toBeNull();
      expect(await extractPackageFile(content, 'pants_targets.py')).toBeNull();
    });

    it('joins string literals the way Python does', async () => {
      // `["foo" ">=1,<2"]` is one requirement in Python, not two.
      const content = codeBlock`
        python_requirement(
            name="split",
            requirements=[
                "flask"
                ">=1.1.2,<1.3",
                "click==8.1.7",
            ],
        )
      `;
      expect(
        (await extractPackageFile(content, 'BUILD.pants'))?.deps,
      ).toMatchObject([
        // No `replaceString`: the joined text is nowhere in the file, so
        // Renovate replaces the version, which is.
        { depName: 'flask', currentValue: '>=1.1.2,<1.3' },
        {
          depName: 'click',
          currentValue: '==8.1.7',
          replaceString: 'click==8.1.7',
        },
      ]);
      expect(
        (await extractPackageFile(content, 'BUILD.pants'))?.deps?.[0]
          ?.replaceString,
      ).toBeUndefined();
    });

    it('reports nothing for a requirement built by a method call', async () => {
      // `.format()` builds the value as much as `%` does, and the template it
      // is called on is not a requirement.
      // Each with a surviving sibling, so the assertion is "exactly the
      // neighbour came back" rather than "nothing did": an absence alone would
      // also pass if parsing failed for an unrelated reason.
      for (const value of [
        '"flask=={}".format(V)',
        '"flask==X".replace("X", V)',
        '"flask==1.0 ".strip()',
      ]) {
        const content = `python_requirement(requirements=[${value}, "click==8.1.7"])\n`;
        expect(
          (await extractPackageFile(content, 'BUILD.pants'))?.deps,
        ).toMatchObject([{ depName: 'click' }]);
      }
    });

    it('reports nothing for a requirement an interpolation builds', async () => {
      // An interpolated literal is part of the value wherever it sits, so the
      // literals around it are not the pin, and they do not join across it
      // either: `["foo==1.0" f"-{X}"]` is not a pin on `foo==1.0`.
      for (const value of [
        'f"flask=={V}"',
        '"flask==1.0" f"-{SUFFIX}"',
        'f"{PREFIX}-" "flask==1.0"',
        '"flask==1.0" f"-{SUFFIX}" "-post1"',
      ]) {
        const content = `python_requirement(requirements=[${value}, "click==8.1.7"])\n`;
        expect(
          (await extractPackageFile(content, 'BUILD.pants'))?.deps,
        ).toMatchObject([{ depName: 'click' }]);
      }
    });

    it('reports nothing for a requirement a structure continues', async () => {
      // A subscript takes part of the literal, so the literal is not the value.
      // A structure that starts an element of its own, such as a call, is
      // stepped over instead, which the neighbouring tests cover.
      const content = 'python_requirement(requirements=["flask==1.0"[0:5]])\n';

      expect(await extractPackageFile(content, 'BUILD.pants')).toBeNull();
    });

    it('reports nothing for a requirement built by concatenation', async () => {
      // `"foo==1.0" + "rc1"` is the pin `foo==1.0rc1`. Reading the first part
      // would report foo at a version it is not pinned to, and the second part
      // as a package of its own.
      const content = codeBlock`
        python_requirement(name="computed", requirements=["foo==1.0" + "rc1"])
      `;
      expect(await extractPackageFile(content, 'BUILD.pants')).toBeNull();
    });

    it('reads the other elements when one is computed', async () => {
      const content = codeBlock`
        python_requirement(requirements=["foo==%s" % VERSION, "real==1.0"])
      `;
      expect(
        (await extractPackageFile(content, 'BUILD.pants'))?.deps,
      ).toMatchObject([{ depName: 'real', currentValue: '==1.0' }]);
    });

    it('treats a parenthesised source expression as unresolved', async () => {
      // `("a.txt" if x else "b.txt")` is not the path `a.txtb.txt`: a break in
      // the run of literals means the value is computed.
      for (const value of [
        '("a.txt" if PY39 else "b.txt")',
        '("a" + SUFFIX)',
        '["a.txt", "b.txt"]',
      ]) {
        const content = `python_requirements(name="reqs", source=${value})\n`;
        expect(await extractPackageFile(content, 'BUILD.pants')).toBeNull();
      }
    });

    it('ignores an operator where an element has not started', async () => {
      const content = codeBlock`
        python_requirement(requirements=["real==1.0", + "computed"])
      `;
      expect(
        (await extractPackageFile(content, 'BUILD.pants'))?.deps,
      ).toMatchObject([{ depName: 'real' }]);
    });

    it('does not read the arguments of a call as requirements', async () => {
      const content = codeBlock`
        python_requirement(requirements=[helper("oops==9.9.9"), "real==1.0"])
      `;
      expect(
        (await extractPackageFile(content, 'BUILD.pants'))?.deps,
      ).toMatchObject([{ depName: 'real' }]);
    });

    it('reports nothing for a requirement chosen by an expression', async () => {
      // Python picks an arm when Pants parses the file, so the field holds one
      // string and neither arm is reliably it. Reporting both would also invite
      // one branch to bump both to the same version, leaving a conditional
      // whose arms are identical: valid Python, conditional on nothing.
      for (const value of [
        '"flask==1.1.2" if PY39 else "flask==2.0.0"',
        '"flask==1.1.2" and PY39',
        '"flask==1.1.2" or PY39',
        '"flask==1.1.2" for _ in RANGE',
      ]) {
        const content = `python_requirement(requirements=[${value}, "click==8.1.7"])\n`;
        expect(
          (await extractPackageFile(content, 'BUILD.pants'))?.deps,
        ).toMatchObject([{ depName: 'click' }]);
      }
    });

    it('reports nothing when an expression selects the whole value', async () => {
      // Around a list rather than inside one. Only one arm is named, so an
      // update would edit an arm that may not be the one in use and leave the
      // live one stale, with nothing in the diff to show it. `and` is worse
      // still: Python yields the other operand, so the requirement read is not
      // in the field under any condition.
      for (const value of [
        '["flask==1.1.2"] if PY39 else ["flask==2.0.0"]',
        '["flask==1.1.2"] or EXTRA',
        '["flask==1.1.2"] and EXTRA',
        '["flask==1.1.2"] not in EXCLUDED',
        '["flask==1.1.2"] is EXTRA',
      ]) {
        const content = `python_requirement(requirements=${value})\n`;
        expect(await extractPackageFile(content, 'BUILD.pants')).toBeNull();
      }
    });

    it('keeps a value an expression only adds to', async () => {
      // The arithmetic around a list preserves membership: every literal read
      // really is in the result, so each can be updated where it is written.
      // Only where the value starts with the list. A value that starts with a
      // name, as in `EXTRA + ["flask==1.1.2"]`, is not read at all: the
      // literal really is in the result, so this is conservative rather than
      // wrong, and it costs silence rather than a bad edit.
      for (const value of [
        '["flask==1.1.2"] + EXTRA',
        '["flask==1.1.2"] * 2',
      ]) {
        const content = `python_requirement(requirements=${value})\n`;
        expect(
          (await extractPackageFile(content, 'BUILD.pants'))?.deps,
        ).toMatchObject([
          {
            depName: 'flask',
            currentValue: '==1.1.2',
            replaceString: 'flask==1.1.2',
          },
        ]);
      }
    });

    it('reports nothing for a target after one an expression selected', async () => {
      // The discard is scoped to the attribute, so the next target is read.
      const content = codeBlock`
        python_requirement(requirements=["dropped==1.0"] if PY39 else ["other==2.0"])

        python_requirement(requirements=["kept==3.0"])
      `;

      expect(
        (await extractPackageFile(content, 'BUILD.pants'))?.deps,
      ).toMatchObject([{ depName: 'kept', currentValue: '==3.0' }]);
    });

    it('keeps the elements an expression does not reach', async () => {
      // Abandoning an element must not abandon its neighbours, in either
      // direction: only a comma finishes one.
      const content = codeBlock`
        python_requirement(
            requirements=[
                "flask==1.1.2" if PY39 else "flask==2.0.0",
                "click==8.1.7",
            ],
        )
      `;
      expect(
        (await extractPackageFile(content, 'BUILD.pants'))?.deps,
      ).toMatchObject([{ depName: 'click', currentValue: '==8.1.7' }]);
    });

    it('skips a requirement whose text is nowhere in the file', async () => {
      // A version specifier split across two literals leaves nothing to
      // replace, so reporting it as updatable would promise an empty diff.
      const content = codeBlock`
        python_requirement(name="split", requirements=["foo>=1.0," "<2.0"])
      `;
      expect(
        (await extractPackageFile(content, 'BUILD.pants'))?.deps,
      ).toMatchObject([
        {
          depName: 'foo',
          currentValue: '>=1.0,<2.0',
          skipReason: 'unsupported',
        },
      ]);
    });

    it('is not fooled by a subscript of a target name', async () => {
      expect(
        await extractPackageFile(
          'FIRST = python_requirements[0]\n',
          'BUILD.pants',
        ),
      ).toBeNull();
    });

    it('reads a tuple of requirements', async () => {
      // Pants accepts any iterable of strings here, not only a list.
      const content = codeBlock`
        python_requirement(name="t", requirements=("django==4.0.0",))
      `;
      expect(
        (await extractPackageFile(content, 'BUILD.pants'))?.deps,
      ).toMatchObject([{ depName: 'django', currentValue: '==4.0.0' }]);
    });

    it('reads a TOML source that holds pip requirements', async () => {
      // Pants reads any source other than a `pyproject.toml` with its
      // requirements parser, whatever the name says.
      expect(
        (await extractPackageFile('boto3==1.34.0\n', 'constraints.toml'))?.deps,
      ).toMatchObject([{ depName: 'boto3', currentValue: '==1.34.0' }]);
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

    it('returns null when requirements is not a list of strings', async () => {
      // Build files are Python, so this is legal and cannot be resolved by
      // reading the file.
      const content = codeBlock`
        COMMON = ["click==8.1.7"]

        python_requirement(name="common", requirements=COMMON)
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
          // Recorded so that the auto-replace confirmation is told how this
          // file was read rather than guessing from its name.
          managerData: { pantsReadAs: 'buildFile' },
        },
      ]);
    });

    it('parses a Poetry pyproject.toml source', async () => {
      const content = codeBlock`
        [tool.poetry]
        name = "my-package"

        [tool.poetry.dependencies]
        python = "^3.11"
        requests = "^2.31.0"

        [tool.poetry.group.dev.dependencies]
        pytest = "^8.0.0"
      `;
      const res = await extractPackageFile(content, 'pyproject.toml');
      expect(res?.deps).toMatchObject([
        { depName: 'python', currentValue: '^3.11' },
        { depName: 'requests', currentValue: '^2.31.0' },
        { depName: 'pytest', currentValue: '^8.0.0', depType: 'dev' },
      ]);
    });

    it('reads a PEP 621 file that carries an unrelated poetry-prefixed table', async () => {
      // The Poetry extractor reads `[project] dependencies` too, so the tables
      // it does not know about are what a wrong route loses.
      const content = codeBlock`
        [project]
        name = "my-package"
        dependencies = ["typing-extensions>=4.8.0,<5.0.0"]

        [dependency-groups]
        test = ["pytest>=8.0.0"]

        [tool.uv]
        dev-dependencies = ["ruff>=0.6.0"]

        [tool.poetry-dynamic-versioning]
        enable = true
      `;
      const res = await extractPackageFile(content, 'pyproject.toml');
      expect(res?.deps).toMatchObject([
        { depName: 'typing-extensions', depType: 'project.dependencies' },
        { depName: 'pytest', depType: 'dependency-groups' },
        { depName: 'ruff', depType: 'tool.uv.dev-dependencies' },
      ]);
    });

    it('reads a Poetry file that only has a dependency group table', async () => {
      const content = codeBlock`
        [project]
        name = "my-package"

        [tool.poetry.group.dev.dependencies]
        pytest = "^8.0.0"
      `;
      const res = await extractPackageFile(content, 'pyproject.toml');
      expect(res?.deps).toMatchObject([
        { depName: 'pytest', currentValue: '^8.0.0', depType: 'dev' },
      ]);
    });

    it('reads Poetry written in other legal spellings', async () => {
      // Table headers may carry spaces or quoted keys, the table may be
      // inline, and the dependencies may be a dotted key. None of these say
      // the literal `[tool.poetry]`.
      const spellings = [
        codeBlock`
          [ tool.poetry ]
          name = "my-package"

          [ tool.poetry.dependencies ]
          requests = "^2.31.0"
        `,
        codeBlock`
          [tool."poetry"]
          name = "my-package"

          [tool."poetry".dependencies]
          requests = "^2.31.0"
        `,
        codeBlock`
          [tool]
          poetry = { name = "my-package", dependencies = { requests = "^2.31.0" } }
        `,
        'tool.poetry.dependencies.requests = "^2.31.0"\n',
      ];

      for (const content of spellings) {
        const res = await extractPackageFile(content, 'pyproject.toml');
        expect(res?.deps).toMatchObject([
          { depName: 'requests', currentValue: '^2.31.0' },
        ]);
      }
    });

    it('ignores a tool.poetry table that only appears inside a string', async () => {
      const content = codeBlock`
        [project]
        name = "my-package"
        description = """
        Migrated away from [tool.poetry] a while ago.
        """
        dependencies = ["typing-extensions>=4.8.0,<5.0.0"]

        [tool.uv]
        dev-dependencies = ["ruff>=0.6.0"]
      `;
      const res = await extractPackageFile(content, 'pyproject.toml');
      expect(res?.deps).toMatchObject([
        { depName: 'typing-extensions', depType: 'project.dependencies' },
        { depName: 'ruff', depType: 'tool.uv.dev-dependencies' },
      ]);
    });

    it('leaves an unparseable pyproject.toml to the PEP 621 extractor', async () => {
      expect(
        await extractPackageFile('this is not toml [[[', 'pyproject.toml'),
      ).toBeNull();
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

    it('reads a Poetry source that is not named pyproject.toml', async () => {
      // Pants does not require the name: a `poetry_requirements` target reads
      // whatever file it is given as Poetry. Re-extraction only knows the
      // name, so this has to work from the content alone.
      const content = codeBlock`
        [tool.poetry.dependencies]
        requests = "^2.31.0"
      `;
      const res = await extractPackageFile(content, 'poetry-dev.toml');
      expect(res?.deps).toMatchObject([
        {
          depName: 'requests',
          currentValue: '^2.31.0',
          depType: 'dependencies',
        },
      ]);
    });

    it('reads a build file named BUILD.toml as a build file', async () => {
      // `build_patterns` covers `BUILD.*`, so the name decides before the
      // extension does, or re-extraction would read it as a TOML source and
      // every update to it would fail.
      const content = codeBlock`
        python_requirement(requirements=["click==8.1.3"])
      `;
      for (const name of ['BUILD.toml', 'BUILD.in', 'BUILD.txt']) {
        expect((await extractPackageFile(content, name))?.deps).toMatchObject([
          { depName: 'click' },
        ]);
      }
    });

    it('does not mistake a source whose name starts with BUILD for a build file', async () => {
      // Only the names Pants' `build_patterns` cover are build files. Reading
      // this as one would disagree with how extraction read it, and every
      // update to it would fail.
      expect(
        (
          await extractPackageFile(
            'requests==2.28.0\n',
            'BUILD_requirements.txt',
          )
        )?.deps,
      ).toMatchObject([{ depName: 'requests' }]);
    });

    it('reads nothing out of a documentation file', async () => {
      // Pants' `build_patterns` match `BUILD.md`, and Pants itself never reads
      // it, because markdown is not Python. A file that documents how to
      // declare a requirement would otherwise have its examples reported, and
      // Renovate would offer to edit the documentation.
      const content = codeBlock`
        # Adding a dependency

        \`\`\`python
        python_requirement(name="flask", requirements=["flask==1.1.2"])
        \`\`\`
      `;

      for (const name of [
        'docs/BUILD.md',
        'docs/BUILD.rst',
        'BUILD.markdown',
        'BUILD.mdx',
        'BUILD.adoc',
        'BUILD.asciidoc',
        'BUILD.org',
        'BUILD.textile',
        // Case is not part of the question.
        'BUILD.MD',
        'BUILD.Rst',
      ]) {
        expect(await extractPackageFile(content, name)).toBeNull();
        // Not overridable. Pants would read the file, and fail on it, so a
        // pattern naming one cannot make its examples into dependencies.
        expect(
          await extractPackageFile(content, name, {
            managerFilePatterns: ['**'],
          }),
        ).toBeNull();
      }
    });

    it('reads a source extension as a source, whatever the file holds', async () => {
      // For these extensions the content cannot make the file a build file, so
      // asking it would only let a stray line that parses as a target change
      // the answer -- and then extraction and the confirmation disagree, and a
      // correct edit is thrown away with no warning.
      const content =
        'real-dep==1.0.0\npython_requirement(requirements=["phantom==9.9.9"])\n';

      for (const name of ['pkg/pins.txt', 'pkg/pins.pip', 'pkg/pins.in']) {
        expect((await extractPackageFile(content, name))?.deps).toMatchObject([
          { depName: 'real-dep' },
        ]);
      }

      // `.toml` is not one of them: a repository can name its build files
      // `*.build.toml`, so there the content is the only thing that can tell
      // the two apart.
      expect(
        (
          await extractPackageFile(
            'python_requirement(requirements=["rich==13.4.0"])\n',
            'pkg/app.build.toml',
          )
        )?.deps,
      ).toMatchObject([{ depName: 'rich' }]);
    });

    it('reads a name it does not recognise by its content', async () => {
      // A build file under a name of its own and a source under an unfamiliar
      // one cannot be told apart by the name. A file holding Pants target calls
      // is not a requirements file, whatever it is called, so the content
      // decides -- and it has to, because this is the state a warm extract
      // cache replays.
      const buildFile = 'python_requirement(requirements=["click==8.1.3"])\n';
      const source = 'requests==2.28.0\n';

      expect(
        (await extractPackageFile(buildFile, 'pkg/app.build.toml'))?.deps,
      ).toMatchObject([{ depName: 'click' }]);
      expect(
        (await extractPackageFile(buildFile, 'pkg/targets.py'))?.deps,
      ).toMatchObject([{ depName: 'click' }]);
      expect(
        (await extractPackageFile(source, 'pkg/constraints'))?.deps,
      ).toMatchObject([{ depName: 'requests' }]);
    });

    it('reads a source whose extension is upper case', async () => {
      // An extension compared case-sensitively falls past every check and
      // reaches the requirements parser, which finds nothing in a TOML file.
      // Both entry points agree on that, so there is no update failure to
      // notice -- the file simply reads as empty.
      const content = codeBlock`
        [tool.poetry.dependencies]
        tenacity = "^8.2.0"
      `;

      expect(
        (await extractPackageFile(content, 'pyproject.TOML'))?.deps,
      ).toMatchObject([{ depName: 'tenacity', currentValue: '^8.2.0' }]);
    });

    it('reads a source with no extension as a requirements file', async () => {
      // Pants does not require an extension, and re-extraction only sees the
      // name, so an unfamiliar one still has to route somewhere.
      expect(
        (await extractPackageFile('click==8.1.7\n', 'constraints'))?.deps,
      ).toMatchObject([{ depName: 'click' }]);
    });

    it('keeps the registry a source names, and claims no lock file', async () => {
      // A source can carry an index and no requirements of its own. The index
      // is worth keeping for the requirements another file pins, and this
      // manager must still not claim a lock file, which it has no way to
      // regenerate.
      const content = '--index-url https://example.com/simple\n';

      const res = await extractPackageFile(content, 'constraints.txt');

      expect(res).toEqual({
        deps: [],
        registryUrls: ['https://example.com/simple'],
      });
      expect(res).not.toHaveProperty('lockFiles');
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

    it('extracts a poetry_requirements source', async () => {
      mockFiles({
        'pkg/BUILD.pants': codeBlock`
          poetry_requirements(
              name="reqs",
              module_mapping={"pillow": ["PIL"]},
          )
        `,
        'pkg/pyproject.toml': codeBlock`
          [tool.poetry]
          name = "my-package"

          [tool.poetry.dependencies]
          requests = "^2.31.0"

          [tool.poetry.group.dev.dependencies]
          pytest = "^8.0.0"
        `,
      });

      const res = await extractAllPackageFiles({}, ['pkg/BUILD.pants']);
      expect(res).toMatchObject([
        {
          packageFile: 'pkg/pyproject.toml',
          deps: [
            { depName: 'requests', depType: 'dependencies' },
            { depName: 'pytest', depType: 'dev' },
          ],
        },
      ]);
    });

    it('extracts a poetry_requirements source from another directory', async () => {
      mockFiles({
        'BUILD.pants':
          'poetry_requirements(name="reqs", source="subdir/pyproject.toml")\n',
        'subdir/pyproject.toml': codeBlock`
          [tool.poetry.dependencies]
          requests = "^2.31.0"
        `,
      });

      const res = await extractAllPackageFiles({}, ['BUILD.pants']);
      expect(res).toMatchObject([
        {
          packageFile: 'subdir/pyproject.toml',
          deps: [{ depName: 'requests' }],
        },
      ]);
    });

    it('extracts a uv_requirements source', async () => {
      mockFiles({
        'pkg/BUILD.pants': 'uv_requirements(name="reqs")\n',
        'pkg/pyproject.toml': codeBlock`
          [project]
          name = "my-package"
          dependencies = ["requests>=2.31.0"]

          [tool.uv]
          dev-dependencies = ["pytest>=8.0.0"]
        `,
      });

      const res = await extractAllPackageFiles({}, ['pkg/BUILD.pants']);
      expect(res).toMatchObject([
        {
          packageFile: 'pkg/pyproject.toml',
          deps: [
            { depName: 'requests', depType: 'project.dependencies' },
            { depName: 'pytest', depType: 'tool.uv.dev-dependencies' },
          ],
        },
      ]);
    });

    it('does not claim a lock file it cannot regenerate', async () => {
      mockFiles({
        'BUILD.pants': 'poetry_requirements(name="poetry")\n',
        'pyproject.toml': codeBlock`
          [tool.poetry.dependencies]
          requests = "^2.31.0"
        `,
        'poetry.lock': '# lock\n',
      });
      // The Poetry extractor reports `poetry.lock` only when it is on disk.
      fs.localPathExists.mockResolvedValue(true);

      // Bumping the source would leave the lock file stale, and only the manager
      // that owns the format can regenerate it. Reporting the file at all would
      // take it from that manager, because an entry is a claim on the file.
      expect(await extractAllPackageFiles({}, ['BUILD.pants'])).toEqual([]);
    });

    it('leaves a lock file beside a source named by the target', async () => {
      mockFiles({
        'BUILD.pants':
          'poetry_requirements(name="poetry", source="poetry-deps.toml")\n',
        'poetry-deps.toml': codeBlock`
          [tool.poetry.dependencies]
          tenacity = "^8.2.0"
        `,
        'poetry.lock': '# lock\n',
      });
      fs.localPathExists.mockResolvedValue(true);

      // `poetry` matches `pyproject.toml` only, so nothing else reports this
      // name and its dependencies go unseen. That is the cost of not claiming a
      // file this manager cannot maintain, and it is the right way round:
      // proposing a bump that leaves the lock file stale is worse than silence.
      expect(await extractAllPackageFiles({}, ['BUILD.pants'])).toEqual([]);
    });

    it('extracts a Poetry source named by the target', async () => {
      mockFiles({
        'BUILD.pants':
          'poetry_requirements(name="reqs", source="poetry-dev.toml")\n',
        'poetry-dev.toml': codeBlock`
          [tool.poetry.dependencies]
          requests = "^2.31.0"

          [tool.poetry.group.dev.dependencies]
          pytest = "^8.0.0"
        `,
      });

      const res = await extractAllPackageFiles({}, ['BUILD.pants']);
      expect(res).toMatchObject([
        {
          packageFile: 'poetry-dev.toml',
          deps: [
            { depName: 'requests', depType: 'dependencies' },
            { depName: 'pytest', depType: 'dev' },
          ],
        },
      ]);
    });

    it('leaves a hashed requirements file alone whatever it is called', async () => {
      // The guard reads the format the file is parsed as, not its name, so a pip
      // requirements file under a `.toml` name is covered too.
      mockFiles({
        'BUILD.pants':
          'python_requirements(name="reqs", source="constraints.toml")\n',
        'constraints.toml': codeBlock`
          boto3==1.34.0 \\
              --hash=sha256:0000000000000000000000000000000000000000000000000000000000000000
        `,
      });

      expect(await extractAllPackageFiles({}, ['BUILD.pants'])).toEqual([]);
    });

    it('leaves a hashed requirements file alone', async () => {
      mockFiles({
        'BUILD.pants': 'python_requirements(name="reqs")\n',
        'requirements.txt': codeBlock`
          click==8.1.7 \\
            --hash=sha256:0000000000000000000000000000000000000000000000000000000000000000
        `,
      });

      // `pip_requirements` refreshes the hashes with `hashin` and claims such a
      // file by name. Reporting it here, even as skipped, would take it from
      // that manager and leave nobody updating it.
      expect(await extractAllPackageFiles({}, ['BUILD.pants'])).toEqual([]);
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

    it('extracts the default source of a generator that takes no arguments', async () => {
      // `python_requirements()` is the documented form: every field has a
      // default, so the target may carry no arguments at all.
      mockFiles({
        'BUILD.pants': 'python_requirements()\n',
        'requirements.txt': 'flask==1.1.2\n',
      });

      const res = await extractAllPackageFiles({}, ['BUILD.pants']);
      expect(res).toMatchObject([
        {
          packageFile: 'requirements.txt',
          deps: [{ depName: 'flask', depType: 'python_requirements' }],
        },
      ]);
    });

    it('extracts a no-argument poetry_requirements', async () => {
      mockFiles({
        'BUILD.pants': 'poetry_requirements()\n',
        'pyproject.toml': codeBlock`
          [tool.poetry.dependencies]
          requests = "^2.31.0"
        `,
      });

      const res = await extractAllPackageFiles({}, ['BUILD.pants']);
      expect(res).toMatchObject([
        { packageFile: 'pyproject.toml', deps: [{ depName: 'requests' }] },
      ]);
    });

    it('joins a source path written as two literals', async () => {
      mockFiles({
        'BUILD.pants': 'python_requirements(source="sub" "/reqs.txt")\n',
        'sub/reqs.txt': 'flask==1.1.2\n',
      });

      const res = await extractAllPackageFiles({}, ['BUILD.pants']);
      expect(res).toMatchObject([
        { packageFile: 'sub/reqs.txt', deps: [{ depName: 'flask' }] },
      ]);
    });

    it('skips a target whose source is a method call on a literal', async () => {
      mockFiles({
        'BUILD.pants': codeBlock`
          python_requirements(name="reqs", source="reqs-{}.txt".format(PY))
        `,
        'reqs-{}.txt': 'must-not-be-read==1.0.0\n',
      });

      expect(await extractAllPackageFiles({}, ['BUILD.pants'])).toEqual([]);
    });

    it('reads every spelling of a literal source', async () => {
      // A matrix rather than one case: the rule that decides whether a source
      // is a literal or an expression is easy to break silently, and each of
      // these is a shape a formatter or a person actually writes.
      const spellings: [string, string][] = [
        ['only argument', 'python_requirements(source="a.txt")'],
        ['trailing comma', 'python_requirements(source="a.txt",)'],
        [
          'newline before comma',
          'python_requirements(\n  source="a.txt"\n  ,\n)',
        ],
        ['close paren next line', 'python_requirements(\n  source="a.txt"\n)'],
        ['comment after value', 'python_requirements(source="a.txt")  # note'],
        [
          'comment inside call',
          'python_requirements(\n  source="a.txt"  # note\n)',
        ],
        [
          'comment line between',
          'python_requirements(\n  name="r",\n  # note\n  source="a.txt",\n)',
        ],
        ['spaces around equals', 'python_requirements(source = "a.txt")'],
        ['single quotes', "python_requirements(source='a.txt')"],
        ['triple quotes', 'python_requirements(source="""a.txt""")'],
        ['raw prefix', 'python_requirements(source=r"a.txt")'],
        ['parenthesised', 'python_requirements(source=("a.txt"))'],
        ['field before', 'python_requirements(name="r", source="a.txt")'],
        ['field after', 'python_requirements(source="a.txt", resolve="py311")'],
        [
          'dict field after',
          'python_requirements(source="a.txt", overrides={"a": {}})',
        ],
      ];

      for (const [name, buildFile] of spellings) {
        mockFiles({
          'BUILD.pants': `${buildFile}\n`,
          'a.txt': 'click==8.1.7\n',
        });
        const res = await extractAllPackageFiles({}, ['BUILD.pants']);
        // The spelling is in the object so a failure names which one failed.
        expect({ name, res }).toMatchObject({
          name,
          res: [{ packageFile: 'a.txt', deps: [{ depName: 'click' }] }],
        });
      }
    });

    it('reads a source written as two adjacent literals', async () => {
      for (const buildFile of [
        'python_requirements(source="sub" "/a.txt")',
        'python_requirements(\n  source="sub"\n  "/a.txt"\n)',
      ]) {
        mockFiles({
          'BUILD.pants': `${buildFile}\n`,
          'sub/a.txt': 'click==8.1.7\n',
        });
        expect(await extractAllPackageFiles({}, ['BUILD.pants'])).toMatchObject(
          [{ packageFile: 'sub/a.txt', deps: [{ depName: 'click' }] }],
        );
      }
    });

    it('skips a target whose source is an expression starting with a literal', async () => {
      // Taking the first branch would claim a file Pants may never read.
      mockFiles({
        'BUILD.pants': codeBlock`
          python_requirements(name="reqs", source="a.txt" if PY39 else "b.txt")
        `,
        'a.txt': 'branch-a==1.0.0\n',
        'b.txt': 'branch-b==2.0.0\n',
      });

      expect(await extractAllPackageFiles({}, ['BUILD.pants'])).toEqual([]);
    });

    it('skips a target whose source an interpolation or a structure continues', async () => {
      // Taking the literal part would name a file Pants never reads, and here
      // that file exists, so the wrong requirements would be reported for it.
      for (const source of ['"sub/" f"{ENV}.txt"', '"sub/reqs.txt"[0:4]']) {
        mockFiles({
          'BUILD.pants': `python_requirements(name="reqs", source=${source})\n`,
          'sub/': 'not-a-file\n',
          'sub/reqs.txt': 'wrong==1.0.0\n',
        });

        expect(await extractAllPackageFiles({}, ['BUILD.pants'])).toEqual([]);
      }
    });

    it('skips a target whose whole source an expression selects', async () => {
      // The literal-level guard does not reach this: the value is a list, and
      // the expression is around it. Taking the first branch would claim a file
      // Pants may never read, and here that file exists.
      mockFiles({
        'BUILD.pants':
          'python_requirements(name="reqs", source=["a.txt"] if PY39 else ["b.txt"])\n',
        'a.txt': 'branch-a==1.0.0\n',
        'b.txt': 'branch-b==2.0.0\n',
      });

      expect(await extractAllPackageFiles({}, ['BUILD.pants'])).toEqual([]);
    });

    it('skips a target whose source is not a literal', async () => {
      // Falling back to the default would claim a file the target does not
      // name, and `supersedesManagers` would take it from its own manager.
      mockFiles({
        'BUILD.pants': codeBlock`
          SRC = "actual-requirements.txt"

          python_requirements(name="reqs", source=SRC)
        `,
        'actual-requirements.txt': 'real==1.0.0\n',
        'requirements.txt': 'unrelated==2.0.0\n',
      });

      expect(await extractAllPackageFiles({}, ['BUILD.pants'])).toEqual([]);
    });

    it('skips missing build files', async () => {
      mockFiles({});
      expect(await extractAllPackageFiles({}, ['missing/BUILD.pants'])).toEqual(
        [],
      );
    });

    it('claims neither a documentation file nor the file its examples name', async () => {
      // The generator target in the fenced example resolved its source
      // relative to the document, so an unrelated `requirements.txt` was
      // claimed as a package file and taken from `pip_requirements`.
      mockFiles({
        'docs/BUILD.md': codeBlock`
          # Adding a dependency

          python_requirement(name="flask", requirements=["flask==1.1.2"])

          python_requirements(name="reqs", source="requirements.txt")
        `,
        'docs/requirements.txt': 'doc-only-dep==7.7.7\n',
      });

      expect(await extractAllPackageFiles({}, ['docs/BUILD.md'])).toEqual([]);
    });

    it('refuses a source that is prose', async () => {
      mockFiles({
        'BUILD.pants': 'python_requirements(name="reqs", source="deps.md")\n',
        'deps.md': 'click==8.1.3\n',
      });

      expect(await extractAllPackageFiles({}, ['BUILD.pants'])).toEqual([]);
    });

    it('claims a source a wide pattern also covers, and records the reading', async () => {
      // The target is the authority on what the file is for, and a pattern wide
      // enough to cover the sources beside the build files does not change
      // that. What made this unsafe before was the confirmation guessing from
      // the name; it is told now.
      mockFiles({
        'glob-source/BUILD.pants':
          'python_requirements(name="reqs", source="constraints")\n',
        'glob-source/constraints': 'click==8.1.3\n',
      });

      expect(
        await extractAllPackageFiles(
          {
            managerFilePatterns: ['/(^|/)BUILD(\\.[^/]+)?$/', 'glob-source/**'],
          },
          ['glob-source/BUILD.pants'],
        ),
      ).toMatchObject([
        {
          packageFile: 'glob-source/constraints',
          deps: [
            {
              depName: 'click',
              managerData: { pantsReadAs: 'source' },
            },
          ],
        },
      ]);
    });

    it('reads a file the way extraction recorded, whatever its name suggests', async () => {
      // The confirmation cannot ask the patterns: `managerFilePatterns` is a
      // repository-stage option, and every update is filtered down to the
      // branch stage before it gets here. Reading a build file as a source, or
      // the reverse, fails the update.
      const buildFile = 'python_requirement(requirements=["rich==13.4.0"])\n';
      const source = 'rich==13.4.0\n';

      expect(
        (
          await extractPackageFile(buildFile, 'app.build.toml', {
            packageFile: 'app.build.toml',
            managerData: { pantsReadAs: 'buildFile' },
          })
        )?.deps,
      ).toMatchObject([{ depName: 'rich' }]);

      // And the other direction: a source whose name the default patterns
      // match is still read as a source when that is how it was read.
      expect(
        (
          await extractPackageFile(source, 'BUILD.txt', {
            packageFile: 'BUILD.txt',
            managerData: { pantsReadAs: 'source' },
          })
        )?.deps,
      ).toMatchObject([{ depName: 'rich' }]);

      // A record on a config that describes a different file is ignored: a
      // branch spanning a build file and a source carries one for both. Here
      // that means falling back to the content, which is the right answer.
      expect(
        (
          await extractPackageFile(buildFile, 'app.build.toml', {
            packageFile: 'other/requirements.txt',
            managerData: { pantsReadAs: 'source' },
          })
        )?.deps,
      ).toMatchObject([{ depName: 'rich' }]);
    });

    it('skips a source file with no deps', async () => {
      mockFiles({
        'BUILD.pants': 'python_requirements(name="reqs")\n',
        'requirements.txt': '# nothing here\n',
      });
      expect(await extractAllPackageFiles({}, ['BUILD.pants'])).toEqual([]);
    });

    it('survives a source that resolves outside the repository', async () => {
      // Reading such a path throws, and an uncaught throw fails extraction for
      // every manager in the repository, not only this one.
      mockFiles({
        'BUILD.pants':
          'python_requirements(name="reqs", source="../../../../etc/passwd")\n',
      });
      fs.readLocalFile.mockImplementation((fileName: string): Promise<any> => {
        if (fileName.includes('..')) {
          return Promise.reject(new Error('file-access-violation-error'));
        }
        return Promise.resolve(
          'python_requirements(name="reqs", source="../../../../etc/passwd")\n',
        );
      });

      expect(await extractAllPackageFiles({}, ['BUILD.pants'])).toEqual([]);
    });

    it('refuses a source that Pants itself reads as a build file', async () => {
      // `BUILD.txt` is a name Pants' own `build_patterns` cover, so Pants reads
      // it as a build file whatever the target says. That is the repository
      // contradicting itself, and picking a side would be a guess.
      mockFiles({
        'BUILD.pants': 'python_requirements(name="reqs", source="BUILD.txt")\n',
        'BUILD.txt': 'click==8.1.3\n',
      });

      expect(await extractAllPackageFiles({}, ['BUILD.pants'])).toEqual([]);
      // Warned rather than logged at debug: the file name is the only clue the
      // user gets that two parts of their repository disagree.
      expect(logger.logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'BUILD.txt' }),
        'pants: a target names a build file as its source',
      );
    });

    it('skips a missing python_requirements source', async () => {
      mockFiles({
        'BUILD.pants': 'python_requirements(name="reqs", source="nope.txt")\n',
      });
      expect(await extractAllPackageFiles({}, ['BUILD.pants'])).toEqual([]);
    });
  });
});
