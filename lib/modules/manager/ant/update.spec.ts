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
      packageFile: 'build.xml',
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
      packageFile: 'build.xml',
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
      packageFile: 'build.xml',
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
      packageFile: 'build.xml',
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
      packageFile: 'build.xml',
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
      packageFile: 'build.xml',
      upgrade: {
        depName: 'junit:junit',
        currentValue: '4.13.2',
        newValue: '4.13.3',
        fileReplacePosition: fileContent.indexOf('4.13.2'),
      },
    });

    expect(result).toContain("version='4.13.3'");
  });

  it('returns null when no quote is found before position', () => {
    const result = updateDependency({
      fileContent: 'no-quotes-here',
      packageFile: 'build.xml',
      upgrade: {
        depName: 'org.example:lib',
        currentValue: '1.0.0',
        newValue: '2.0.0',
        fileReplacePosition: 5,
      },
    });

    expect(result).toBeNull();
  });
});
