/**
 * Repro helpers for:
 * - Discussion #44559: replacement PR for Maven only bumps version
 *   (annotationProcessorPaths / <path> coords not rewritten)
 * - PR #40149: skip replacement when sibling already exists
 *
 * Run alone:
 *   pnpm test-integration:gerrit test/integration/gerrit/maven-replacement.spec.ts
 */
import { isNonEmptyString } from '@sindresorhus/is';
import { regEx } from '../../../lib/util/regex.ts';
import {
  createAndConfigureProject,
  getChangeFileContent,
  getOpenChanges,
} from './utils/gerrit-api.ts';
import {
  startGerritContainer,
  stopGerritContainer,
} from './utils/gerrit-container.ts';
import { renovate } from './utils/renovate.ts';

const SCHEMA = 'https://docs.renovatebot.com/renovate-schema.json';
const OLD_COORDS = 'org.hibernate:hibernate-jpamodelgen';
const NEW_COORDS = 'org.hibernate.orm:hibernate-processor';
const OLD_VERSION = '7.4.4.Final';
const NEW_VERSION = '7.4.5.Final';
const replaceSubjectRe = regEx(/replace dependency/i);

function renovateJson(extra: Record<string, unknown> = {}): string {
  return JSON.stringify(
    {
      $schema: SCHEMA,
      extends: ['config:recommended'],
      enabledManagers: ['maven'],
      // Avoid noise from the compiler plugin / unrelated deps
      ignoreDeps: ['org.apache.maven.plugins:maven-compiler-plugin'],
      packageRules: [
        {
          matchPackageNames: [OLD_COORDS],
          replacementName: NEW_COORDS,
          replacementVersion: NEW_VERSION,
        },
      ],
      ...extra,
    },
    null,
    2,
  );
}

/** Matches the #44559 screenshot: coords live under annotationProcessorPaths/<path>. */
function pomWithAnnotationProcessorPath(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>repro-44559</artifactId>
  <version>1.0.0</version>
  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-compiler-plugin</artifactId>
        <version>3.13.0</version>
        <configuration>
          <annotationProcessorPaths>
            <path>
              <groupId>org.hibernate</groupId>
              <artifactId>hibernate-jpamodelgen</artifactId>
              <version>${OLD_VERSION}</version>
            </path>
          </annotationProcessorPaths>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>
`;
}

/** Control: same replacement but under a normal <dependency> block. */
function pomWithDependency(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>repro-dependency</artifactId>
  <version>1.0.0</version>
  <dependencies>
    <dependency>
      <groupId>org.hibernate</groupId>
      <artifactId>hibernate-jpamodelgen</artifactId>
      <version>${OLD_VERSION}</version>
    </dependency>
  </dependencies>
</project>
`;
}

/**
 * Both old and new already present — #40149 should skip proposing the
 * replacement entirely (no "Replace dependency …" change).
 */
function pomWithSiblingReplacementAlreadyPresent(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>repro-40149</artifactId>
  <version>1.0.0</version>
  <dependencies>
    <dependency>
      <groupId>org.hibernate</groupId>
      <artifactId>hibernate-jpamodelgen</artifactId>
      <version>${OLD_VERSION}</version>
    </dependency>
    <dependency>
      <groupId>org.hibernate.orm</groupId>
      <artifactId>hibernate-processor</artifactId>
      <version>${OLD_VERSION}</version>
    </dependency>
  </dependencies>
</project>
`;
}

function findReplaceChange(
  changes: Awaited<ReturnType<typeof getOpenChanges>>,
) {
  return changes.find((c) => replaceSubjectRe.test(c.subject));
}

describe('integration/gerrit/maven-replacement', { timeout: 180_000 }, () => {
  beforeAll(async () => {
    await startGerritContainer();
  }, 180_000);

  afterAll(async () => {
    await stopGerritContainer();
  }, 60_000);

  it('repro #44559: annotationProcessorPaths replacement only bumps version', async () => {
    // Arrange — mirrors https://github.com/renovatebot/renovate/discussions/44559
    const REPO = 'test-maven-replacement-path';
    await createAndConfigureProject(REPO, {
      'pom.xml': pomWithAnnotationProcessorPath(),
      'renovate.json': renovateJson(),
    });

    // Act
    await renovate([REPO]);

    // Assert
    const changes = await getOpenChanges(REPO);
    const ch = findReplaceChange(changes);

    expect(ch).toBeDefined();
    expect(ch!.subject.toLowerCase()).toContain('hibernate-jpamodelgen');
    expect(ch!.subject.toLowerCase()).toContain('hibernate-processor');

    const pom = await getChangeFileContent(ch!._number, 'pom.xml');
    expect(isNonEmptyString(pom)).toBe(true);

    // Version is updated (partial apply) …
    expect(pom).toContain(`<version>${NEW_VERSION}</version>`);
    expect(pom).not.toContain(`<version>${OLD_VERSION}</version>`);

    // … but coords under <path> are NOT rewritten (the #44559 bug).
    // Root cause: maven/update.ts only rewrites name inside
    // <parent|dependency|plugin|extension>, not <path>.
    // Flip these expectations when that is fixed.
    expect(pom).toContain('<groupId>org.hibernate</groupId>');
    expect(pom).toContain('<artifactId>hibernate-jpamodelgen</artifactId>');
    expect(pom).not.toContain('<groupId>org.hibernate.orm</groupId>');
    expect(pom).not.toContain('<artifactId>hibernate-processor</artifactId>');
  });

  it('control: normal <dependency> replacement rewrites name and version', async () => {
    // Arrange
    const REPO = 'test-maven-replacement-dependency';
    await createAndConfigureProject(REPO, {
      'pom.xml': pomWithDependency(),
      'renovate.json': renovateJson(),
    });

    // Act
    await renovate([REPO]);

    // Assert
    const ch = findReplaceChange(await getOpenChanges(REPO));
    expect(ch).toBeDefined();

    const pom = await getChangeFileContent(ch!._number, 'pom.xml');
    expect(isNonEmptyString(pom)).toBe(true);

    expect(pom).toContain('<groupId>org.hibernate.orm</groupId>');
    expect(pom).toContain('<artifactId>hibernate-processor</artifactId>');
    expect(pom).toContain(`<version>${NEW_VERSION}</version>`);
    expect(pom).not.toContain('<artifactId>hibernate-jpamodelgen</artifactId>');
  });

  it('#40149: skips replacement when target already exists as sibling', async () => {
    // Arrange
    const REPO = 'test-maven-replacement-sibling-exists';
    await createAndConfigureProject(REPO, {
      'pom.xml': pomWithSiblingReplacementAlreadyPresent(),
      'renovate.json': renovateJson(),
    });

    // Act
    await renovate([REPO]);

    // Assert — with #40149: no "Replace dependency …" change
    // (without #40149 this would open a replacement change instead)
    const changes = await getOpenChanges(REPO);
    expect(findReplaceChange(changes)).toBeUndefined();
  });
});
