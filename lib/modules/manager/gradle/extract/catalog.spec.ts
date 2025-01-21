import { codeBlock } from 'common-tags';
import { parseCatalog } from './catalog';

describe('modules/manager/gradle/extract/catalog', () => {
  it('supports versions declared as single string', () => {
    const input = codeBlock`
      [versions]
      kotlin = "1.5.21"
      retro_fit = "2.8.2"

      [libraries]
      okHttp = "com.squareup.okhttp3:okhttp:4.9.0"
      okio = { module = "com.squareup.okio:okio", version = "2.8.0" }
      picasso = { group = "com.squareup.picasso", name = "picasso", version = "2.5.1" }
      retrofit2-retrofit = { module = "com.squareup.retrofit2:retrofit", version.ref = "retro_fit" }
      google-firebase-analytics = { module = "com.google.firebase:firebase-analytics" }
      google-firebase-crashlytics = { group = "com.google.firebase", name = "firebase-crashlytics" }
      google-firebase-messaging = "com.google.firebase:firebase-messaging"

      [plugins]
      kotlinJvm = { id = "org.jetbrains.kotlin.jvm", version = "1.5.21" }
      kotlinSerialization = { id = "org.jetbrains.kotlin.plugin.serialization", version.ref = "kotlin" }
      multiJvm = "org.danilopianini.multi-jvm-test-plugin:0.3.0"
    `;
    const res = parseCatalog('gradle/libs.versions.toml', input);
    expect(res).toStrictEqual([
      {
        depName: 'com.squareup.okhttp3:okhttp',
        currentValue: '4.9.0',
        managerData: {
          fileReplacePosition: 100,
          packageFile: 'gradle/libs.versions.toml',
        },
      },
      {
        depName: 'com.squareup.okio:okio',
        currentValue: '2.8.0',
        managerData: {
          fileReplacePosition: 162,
          packageFile: 'gradle/libs.versions.toml',
        },
      },
      {
        depName: 'com.squareup.picasso:picasso',
        currentValue: '2.5.1',
        managerData: {
          fileReplacePosition: 244,
          packageFile: 'gradle/libs.versions.toml',
        },
      },
      {
        depName: 'com.squareup.retrofit2:retrofit',
        sharedVariableName: 'retro.fit',
        currentValue: '2.8.2',
        managerData: {
          fileReplacePosition: 42,
          packageFile: 'gradle/libs.versions.toml',
        },
      },
      {
        depName: 'google-firebase-analytics',
        managerData: {
          packageFile: 'gradle/libs.versions.toml',
        },
        skipReason: 'unspecified-version',
      },
      {
        depName: 'google-firebase-crashlytics',
        managerData: {
          packageFile: 'gradle/libs.versions.toml',
        },
        skipReason: 'unspecified-version',
      },
      {
        depName: 'google-firebase-messaging',
        managerData: {
          packageFile: 'gradle/libs.versions.toml',
        },
        skipReason: 'unspecified-version',
      },
      {
        depName: 'org.jetbrains.kotlin.jvm',
        depType: 'plugin',
        currentValue: '1.5.21',
        commitMessageTopic: 'plugin kotlinJvm',
        packageName:
          'org.jetbrains.kotlin.jvm:org.jetbrains.kotlin.jvm.gradle.plugin',
        managerData: {
          fileReplacePosition: 663,
          packageFile: 'gradle/libs.versions.toml',
        },
      },
      {
        depName: 'org.jetbrains.kotlin.plugin.serialization',
        depType: 'plugin',
        currentValue: '1.5.21',
        sharedVariableName: 'kotlin',
        packageName:
          'org.jetbrains.kotlin.plugin.serialization:org.jetbrains.kotlin.plugin.serialization.gradle.plugin',
        managerData: {
          fileReplacePosition: 21,
          packageFile: 'gradle/libs.versions.toml',
        },
      },
      {
        depName: 'org.danilopianini.multi-jvm-test-plugin',
        depType: 'plugin',
        currentValue: '0.3.0',
        commitMessageTopic: 'plugin multiJvm',
        packageName:
          'org.danilopianini.multi-jvm-test-plugin:org.danilopianini.multi-jvm-test-plugin.gradle.plugin',
        managerData: {
          fileReplacePosition: 824,
          packageFile: 'gradle/libs.versions.toml',
        },
      },
    ]);
  });

  it('deletes commit message for plugins with version reference', () => {
    const input = codeBlock`
      [versions]
      detekt = "1.18.1"

      [plugins]
      detekt = { id = "io.gitlab.arturbosch.detekt", version.ref = "detekt" }

      [libraries]
      detekt-formatting = { module = "io.gitlab.arturbosch.detekt:detekt-formatting", version.ref = "detekt" }
    `;
    const res = parseCatalog('gradle/libs.versions.toml', input);

    expect(res).toStrictEqual([
      {
        depName: 'io.gitlab.arturbosch.detekt:detekt-formatting',
        sharedVariableName: 'detekt',
        currentValue: '1.18.1',
        managerData: {
          fileReplacePosition: 21,
          packageFile: 'gradle/libs.versions.toml',
        },
      },
      {
        depType: 'plugin',
        depName: 'io.gitlab.arturbosch.detekt',
        packageName:
          'io.gitlab.arturbosch.detekt:io.gitlab.arturbosch.detekt.gradle.plugin',
        currentValue: '1.18.1',
        managerData: {
          fileReplacePosition: 21,
          packageFile: 'gradle/libs.versions.toml',
        },
        sharedVariableName: 'detekt',
      },
    ]);
  });

  it('changes the dependency version, not the comment version', () => {
    const input = codeBlock`
      [versions]
      # Releases: http://someWebsite.com/junit/1.4.9
      mocha-junit-reporter = "2.0.2"
      # JUnit 1.4.9 is awesome!
      junit = "1.4.9"


      [libraries]
      junit-legacy = { module = "junit:junit", version.ref = "junit" }
      mocha-junit = { module = "mocha-junit:mocha-junit", version.ref = "mocha.junit.reporter" }
    `;
    const res = parseCatalog('gradle/libs.versions.toml', input);

    expect(res).toStrictEqual([
      {
        depName: 'junit:junit',
        sharedVariableName: 'junit',
        currentValue: '1.4.9',
        managerData: {
          fileReplacePosition: 124,
          packageFile: 'gradle/libs.versions.toml',
        },
      },
      {
        depName: 'mocha-junit:mocha-junit',
        sharedVariableName: 'mocha.junit.reporter',
        currentValue: '2.0.2',
        managerData: {
          fileReplacePosition: 82,
          packageFile: 'gradle/libs.versions.toml',
        },
      },
    ]);
  });
});
