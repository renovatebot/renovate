import { codeBlock } from 'common-tags';
import { updateDependency } from './update.ts';

describe('modules/manager/ant/update', () => {
  it('updates XML version attributes', () => {
    const fileContent = codeBlock`
      <project>
        <artifact:dependencies>
          <dependency groupId="junit" artifactId="junit" version="4.13.2" />
        </artifact:dependencies>
      </project>
    `;

    const result = updateDependency({
      fileContent,
      upgrade: {
        depName: 'junit:junit',
        currentValue: '4.13.2',
        newValue: '4.13.3',
        fileReplacePosition: fileContent.indexOf('4.13.2'),
      },
    });

    expect(result).toContain('version="4.13.3"');
  });

  it('returns null when fileReplacePosition is missing', () => {
    const result = updateDependency({
      fileContent: '<project />',
      upgrade: {
        depName: 'junit:junit',
        currentValue: '1.0',
        newValue: '2.0',
      },
    });

    expect(result).toBeNull();
  });

  it('returns null when newValue is missing', () => {
    const result = updateDependency({
      fileContent: '<project />',
      upgrade: {
        depName: 'junit:junit',
        currentValue: '1.0',
        fileReplacePosition: 0,
      },
    });

    expect(result).toBeNull();
  });

  it('returns fileContent unchanged when already updated', () => {
    const fileContent = codeBlock`
      <project>
        <dependency groupId="junit" artifactId="junit" version="4.13.3" />
      </project>
    `;

    const result = updateDependency({
      fileContent,
      upgrade: {
        depName: 'junit:junit',
        currentValue: '4.13.3',
        newValue: '4.13.3',
        fileReplacePosition: fileContent.indexOf('4.13.3'),
      },
    });

    expect(result).toBe(fileContent);
  });

  it('returns null when version at position does not match', () => {
    const fileContent = codeBlock`
      <project>
        <dependency groupId="junit" artifactId="junit" version="9.9.9" />
      </project>
    `;

    const result = updateDependency({
      fileContent,
      upgrade: {
        depName: 'junit:junit',
        currentValue: '4.13.2',
        newValue: '4.13.3',
        fileReplacePosition: fileContent.indexOf('9.9.9'),
      },
    });

    expect(result).toBeNull();
  });

  it('handles single-quoted XML attributes', () => {
    const fileContent =
      "<project><dependency groupId='junit' artifactId='junit' version='4.13.2' /></project>";

    const result = updateDependency({
      fileContent,
      upgrade: {
        depName: 'junit:junit',
        currentValue: '4.13.2',
        newValue: '4.13.3',
        fileReplacePosition: fileContent.indexOf('4.13.2'),
      },
    });

    expect(result).toContain("version='4.13.3'");
  });

  it('updates properties file values', () => {
    const fileContent = 'slf4j.version=1.7.36\nother=value\n';

    const result = updateDependency({
      fileContent,
      upgrade: {
        depName: 'org.slf4j:slf4j-api',
        currentValue: '1.7.36',
        newValue: '2.0.17',
        fileReplacePosition: fileContent.indexOf('1.7.36'),
        sharedVariableName: 'slf4j.version',
      },
    });

    expect(result).toContain('slf4j.version=2.0.17');
  });

  it('returns null when properties value does not match and no sharedVariableName', () => {
    const fileContent = 'some.version=9.9.9\n';

    const result = updateDependency({
      fileContent,
      upgrade: {
        depName: 'org.example:lib',
        currentValue: '1.0.0',
        newValue: '2.0.0',
        fileReplacePosition: fileContent.indexOf('9.9.9'),
      },
    });

    expect(result).toBeNull();
  });

  it('updates properties value when sharedVariableName is set even if mismatch', () => {
    const fileContent = 'my.version=999\n';

    const result = updateDependency({
      fileContent,
      upgrade: {
        depName: 'org.example:lib',
        currentValue: '1.0.0',
        newValue: '2.0.0',
        fileReplacePosition: fileContent.indexOf('999'),
        sharedVariableName: 'my.version',
      },
    });

    expect(result).toContain('my.version=2.0.0');
  });

  it('returns fileContent unchanged when properties value already matches newValue', () => {
    const fileContent = 'slf4j.version=2.0.17\nother=value\n';

    const result = updateDependency({
      fileContent,
      upgrade: {
        depName: 'org.slf4j:slf4j-api',
        currentValue: '1.7.36',
        newValue: '2.0.17',
        fileReplacePosition: fileContent.indexOf('2.0.17'),
        sharedVariableName: 'slf4j.version',
      },
    });

    expect(result).toBe(fileContent);
  });

  it('returns null when properties line is empty at offset', () => {
    const fileContent = 'some.version=\n';

    const result = updateDependency({
      fileContent,
      upgrade: {
        depName: 'org.example:lib',
        currentValue: '1.0.0',
        newValue: '2.0.0',
        fileReplacePosition: fileContent.indexOf('\n'),
      },
    });

    expect(result).toBeNull();
  });

  it('returns null when no quote is found before position', () => {
    const result = updateDependency({
      fileContent: 'no-quotes-here',
      upgrade: {
        depName: 'org.example:lib',
        currentValue: '1.0.0',
        newValue: '2.0.0',
        fileReplacePosition: 5,
      },
    });

    expect(result).toBeNull();
  });

  it('updates version within coords attribute', () => {
    const fileContent =
      '<project><dependency coords="junit:junit:4.13.2" /></project>';

    const result = updateDependency({
      fileContent,
      upgrade: {
        depName: 'junit:junit',
        currentValue: '4.13.2',
        newValue: '4.13.3',
        fileReplacePosition: fileContent.indexOf('4.13.2'),
      },
    });

    expect(result).toContain('coords="junit:junit:4.13.3"');
  });
});
