import { codeBlock } from 'common-tags';
import { updateDependency } from './index.ts';
import { parseGradle } from './parser.ts';

describe('modules/manager/gradle/update', () => {
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
