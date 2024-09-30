import { z } from 'zod';
import { MavenTarget } from './maven';

describe('MavenTarget schema', () => {
  it('should handle 3-arity coordinates', () => {
    const input = {
      rule: 'maven_install',
      artifacts: ['com.example:artifact:1.0.0'],
      repositories: ['https://repo.maven.apache.org/maven2'],
    };

    const result = MavenTarget.parse(input);

    expect(result).toEqual([
      {
        datasource: 'maven',
        versioning: 'gradle',
        depName: 'com.example:artifact',
        currentValue: '1.0.0',
        depType: 'maven_install',
        registryUrls: ['https://repo.maven.apache.org/maven2'],
      },
    ]);
  });

  it('should handle 4-arity coordinates', () => {
    const input = {
      rule: 'maven_install',
      artifacts: ['com.example:artifact:jar:1.0.0'],
      repositories: ['https://repo.maven.apache.org/maven2'],
    };

    const result = MavenTarget.parse(input);

    expect(result).toEqual([
      {
        datasource: 'maven',
        versioning: 'gradle',
        depName: 'com.example:artifact',
        currentValue: '1.0.0',
        depType: 'maven_install',
        registryUrls: ['https://repo.maven.apache.org/maven2'],
        packaging: 'jar',
      },
    ]);
  });

  it('should handle 5-arity coordinates', () => {
    const input = {
      rule: 'maven_install',
      artifacts: ['com.example:artifact:jar:linux-x86_64:1.0.0'],
      repositories: ['https://repo.maven.apache.org/maven2'],
    };

    const result = MavenTarget.parse(input);

    expect(result).toEqual([
      {
        datasource: 'maven',
        versioning: 'gradle',
        depName: 'com.example:artifact',
        currentValue: '1.0.0',
        depType: 'maven_install',
        registryUrls: ['https://repo.maven.apache.org/maven2'],
        packaging: 'jar',
        classifier: 'linux-x86_64',
      },
    ]);
  });

  it('should handle mixed coordinates', () => {
    const input = {
      rule: 'maven_install',
      artifacts: [
        'com.example:artifact:1.0.0',
        'com.example:artifact:jar:1.0.0',
        'com.example:artifact:jar:linux-x86_64:1.0.0',
      ],
      repositories: ['https://repo.maven.apache.org/maven2'],
    };

    const result = MavenTarget.parse(input);

    expect(result).toEqual([
      {
        datasource: 'maven',
        versioning: 'gradle',
        depName: 'com.example:artifact',
        currentValue: '1.0.0',
        depType: 'maven_install',
        registryUrls: ['https://repo.maven.apache.org/maven2'],
      },
      {
        datasource: 'maven',
        versioning: 'gradle',
        depName: 'com.example:artifact',
        currentValue: '1.0.0',
        depType: 'maven_install',
        registryUrls: ['https://repo.maven.apache.org/maven2'],
        packaging: 'jar',
      },
      {
        datasource: 'maven',
        versioning: 'gradle',
        depName: 'com.example:artifact',
        currentValue: '1.0.0',
        depType: 'maven_install',
        registryUrls: ['https://repo.maven.apache.org/maven2'],
        packaging: 'jar',
        classifier: 'linux-x86_64',
      },
    ]);
  });
});
