import { updateDependency } from './update.ts';

describe('modules/manager/ant/update', () => {
  it('updates inline XML version attribute', () => {
    const fileContent =
      '<dependency groupId="junit" artifactId="junit" version="4.13.1" />';
    const result = updateDependency({
      fileContent,
      packageFile: 'build.xml',
      upgrade: {
        depName: 'junit:junit',
        currentValue: '4.13.1',
        newValue: '4.13.2',
        fileReplacePosition: fileContent.indexOf('4.13.1'),
      },
    });

    expect(result).toBe(
      '<dependency groupId="junit" artifactId="junit" version="4.13.2" />',
    );
  });

  it('updates single-quoted XML version attribute', () => {
    const fileContent =
      "<dependency groupId='junit' artifactId='junit' version='4.13.1' />";
    const result = updateDependency({
      fileContent,
      packageFile: 'build.xml',
      upgrade: {
        depName: 'junit:junit',
        currentValue: '4.13.1',
        newValue: '4.13.2',
        fileReplacePosition: fileContent.indexOf('4.13.1'),
      },
    });

    expect(result).toBe(
      "<dependency groupId='junit' artifactId='junit' version='4.13.2' />",
    );
  });

  it('updates .properties file value', () => {
    const fileContent = 'junit.version=4.13.1\nother.key=value\n';
    const result = updateDependency({
      fileContent,
      packageFile: 'versions.properties',
      upgrade: {
        depName: 'junit:junit',
        currentValue: '4.13.1',
        newValue: '4.13.2',
        fileReplacePosition: fileContent.indexOf('4.13.1'),
      },
    });

    expect(result).toBe('junit.version=4.13.2\nother.key=value\n');
  });

  it('updates .properties value at end of file without trailing newline', () => {
    const fileContent = 'junit.version=4.13.1';
    const result = updateDependency({
      fileContent,
      packageFile: 'versions.properties',
      upgrade: {
        depName: 'junit:junit',
        currentValue: '4.13.1',
        newValue: '4.13.2',
        fileReplacePosition: fileContent.indexOf('4.13.1'),
      },
    });

    expect(result).toBe('junit.version=4.13.2');
  });

  it('returns fileContent unchanged when already updated', () => {
    const fileContent =
      '<dependency groupId="junit" artifactId="junit" version="4.13.2" />';
    const result = updateDependency({
      fileContent,
      packageFile: 'build.xml',
      upgrade: {
        depName: 'junit:junit',
        currentValue: '4.13.1',
        newValue: '4.13.2',
        fileReplacePosition: fileContent.indexOf('4.13.2'),
      },
    });

    expect(result).toBe(fileContent);
  });

  it('updates when sharedVariableName is set even if currentValue differs', () => {
    const fileContent = '<property name="junit.version" value="4.13.1"/>';
    const result = updateDependency({
      fileContent,
      packageFile: 'build.xml',
      upgrade: {
        depName: 'junit:junit',
        currentValue: '4.13.0',
        newValue: '4.13.2',
        sharedVariableName: 'junit.version',
        fileReplacePosition: fileContent.indexOf('4.13.1'),
      },
    });

    expect(result).toBe('<property name="junit.version" value="4.13.2"/>');
  });

  it('returns null when fileReplacePosition is undefined', () => {
    const result = updateDependency({
      fileContent: '<dependency version="1.0"/>',
      packageFile: 'build.xml',
      upgrade: {
        depName: 'org.example:lib',
        currentValue: '1.0',
        newValue: '2.0',
      },
    });

    expect(result).toBeNull();
  });

  it('updates version within coords attribute', () => {
    const fileContent =
      '<project><dependency coords="junit:junit:4.13.2" /></project>';

    const result = updateDependency({
      fileContent,
      packageFile: 'build.xml',
      upgrade: {
        depName: 'junit:junit',
        currentValue: '4.13.2',
        newValue: '4.13.3',
        fileReplacePosition: fileContent.indexOf('4.13.2'),
      },
    });

    expect(result).toContain('coords="junit:junit:4.13.3"');
  });

  it('updates version within 4-part coords attribute', () => {
    const fileContent =
      '<project><dependency coords="junit:junit:4.13.2:test" /></project>';

    const result = updateDependency({
      fileContent,
      packageFile: 'build.xml',
      upgrade: {
        depName: 'junit:junit',
        currentValue: '4.13.2',
        newValue: '4.13.3',
        fileReplacePosition: fileContent.indexOf('4.13.2'),
      },
    });

    expect(result).toContain('coords="junit:junit:4.13.3:test"');
  });

  it('returns null when value at position does not match', () => {
    const fileContent =
      '<dependency groupId="junit" artifactId="junit" version="9.9.9" />';
    const result = updateDependency({
      fileContent,
      packageFile: 'build.xml',
      upgrade: {
        depName: 'junit:junit',
        currentValue: '4.13.1',
        newValue: '4.13.2',
        fileReplacePosition: fileContent.indexOf('9.9.9'),
      },
    });

    expect(result).toBeNull();
  });
});
