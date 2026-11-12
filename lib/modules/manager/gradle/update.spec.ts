import { codeBlock } from 'common-tags';
import { parseCatalog } from './extract/catalog.ts';
import { updateDependency } from './index.ts';
import { parseGradle } from './parser.ts';

describe('modules/manager/gradle/update', () => {
  it.each`
    section        | declaration
    ${'libraries'} | ${'demo = "org.example:demo:1.0.0"'}
    ${'libraries'} | ${'demo = { module = "org.example:demo", version = "1.0.0" }'}
    ${'libraries'} | ${'demo = { module = "org.example:demo", version = { strictly = "1.0.0" } }'}
    ${'plugins'}   | ${'demo = "org.example.demo:1.0.0"'}
    ${'plugins'}   | ${'demo = { id = "org.example.demo", version = "1.0.0" }'}
    ${'versions'}  | ${'demo = "1.0.0"'}
  `(
    'ignores commented catalog declarations: $declaration',
    ({ section, declaration }) => {
      const suffix =
        section === 'versions'
          ? '\n[libraries]\ndemo = { module = "org.example:demo", version.ref = "demo" }'
          : '';
      const fileContent = `${codeBlock`
        [${section}]
        # ${declaration}
        ${declaration}
      `}${suffix}`;
      const packageFile = 'gradle/libs.versions.toml';
      const { deps } = parseCatalog(packageFile, fileContent);

      const result = updateDependency({
        fileContent,
        packageFile,
        upgrade: { ...deps[0], newValue: '2.0.0' },
      });

      expect(result).toBe(
        `${codeBlock`
          [${section}]
          # ${declaration}
          ${declaration.replace('1.0.0', '2.0.0')}
        `}${suffix}`,
      );
    },
  );

  it('replaces', () => {
    expect(
      updateDependency({
        fileContent: '###1.2.3###',
        packageFile: 'build.gradle',
        upgrade: {
          currentValue: '1.2.3',
          newValue: '1.2.4',
          managerData: {
            fileReplacePosition: 3,
          },
        },
      }),
    ).toBe('###1.2.4###');
  });

  it('groups', () => {
    expect(
      updateDependency({
        fileContent: '###1.2.4###',
        packageFile: 'build.gradle',
        upgrade: {
          currentValue: '1.2.3',
          newValue: '1.2.5',
          sharedVariableName: 'group',
          managerData: {
            fileReplacePosition: 3,
          },
        },
      }),
    ).toBe('###1.2.5###');
  });

  it('returns same content', () => {
    const fileContent = '###1.2.4###';
    expect(
      updateDependency({
        fileContent,
        packageFile: 'build.gradle',
        upgrade: {
          currentValue: '1.2.3',
          newValue: '1.2.4',
          managerData: {
            fileReplacePosition: 3,
          },
        },
      }),
    ).toBe(fileContent);
  });

  it('returns null', () => {
    expect(
      updateDependency({
        fileContent: '###1.3.0###',
        packageFile: 'build.gradle',
        upgrade: {
          currentValue: '1.2.3',
          newValue: '1.2.4',
          managerData: {
            fileReplacePosition: 3,
          },
        },
      }),
    ).toBeNull();

    expect(
      updateDependency({
        fileContent: '',
        packageFile: 'build.gradle',
        upgrade: {
          currentValue: '1.2.3',
          newValue: '1.2.4',
          managerData: {
            fileReplacePosition: 3,
          },
        },
      }),
    ).toBeNull();
  });

  it.each`
    constraint    | currentValue    | newValue
    ${'strictly'} | ${'1.2.3'}      | ${'1.2.4'}
    ${'strictly'} | ${'[1.7, 1.8['} | ${'[1.8, 1.9['}
    ${'require'}  | ${'1.2.3'}      | ${'1.2.4'}
    ${'prefer'}   | ${'1.2.3'}      | ${'1.2.4'}
  `(
    'replaces a $constraint rich version constraint',
    ({ constraint, currentValue, newValue }) => {
      const fileContent = codeBlock`
        dependencies {
          implementation('foo:bar') {
            version {
              ${constraint} '${currentValue}'
            }
          }
        }
      `;
      const [dep] = parseGradle(fileContent, {}, 'build.gradle').deps;
      expect(dep).toMatchObject({
        currentValue,
        managerData: { versionConstraint: constraint },
      });

      expect(
        updateDependency({
          fileContent,
          packageFile: 'build.gradle',
          upgrade: { ...dep, newValue },
        }),
      ).toBe(fileContent.replace(currentValue, newValue));
    },
  );

  it('should return null for replacement', () => {
    const res = updateDependency({
      fileContent: '',
      packageFile: 'build.gradle',
      upgrade: { updateType: 'replacement' },
    });
    expect(res).toBeNull();
  });
});
