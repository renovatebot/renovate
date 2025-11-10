import { codeBlock } from 'common-tags';
import * as sbtUpdater from '.';

describe('modules/manager/sbt/update', () => {
  describe('.bumpPackageVersion()', () => {
    const content =
      'name := "test"\n' +
      'organization := "test-org"\n' +
      'version := "0.0.2"\n';

    it('increments', () => {
      const { bumpedContent } = sbtUpdater.bumpPackageVersion(
        content,
        '0.0.2',
        'patch',
      );

      expect(bumpedContent).toEqual(content.replace('0.0.2', '0.0.3'));
      expect(bumpedContent).not.toEqual(content);
    });

    it('no ops', () => {
      const { bumpedContent } = sbtUpdater.bumpPackageVersion(
        content,
        '0.0.1',
        'patch',
      );

      expect(bumpedContent).toEqual(content);
    });

    it('updates', () => {
      const { bumpedContent } = sbtUpdater.bumpPackageVersion(
        content,
        '0.0.1',
        'minor',
      );
      expect(bumpedContent).toEqual(content.replace('0.0.2', '0.1.0'));
      expect(bumpedContent).not.toEqual(content);
    });

    it('returns content if bumping errors', () => {
      const { bumpedContent } = sbtUpdater.bumpPackageVersion(
        content,
        '0.0.2',
        true as any,
      );

      expect(bumpedContent).toEqual(content);
    });
  });

  describe('.updateDependency()', () => {
    it('should update version in simple case', () => {
      const simpleContent = codeBlock`libraryDependencies += "org.example" %% "foo" % "1.0.0"`;

      const res = sbtUpdater.updateDependency({
        fileContent: simpleContent,
        upgrade: {
          depName: 'org.example:foo',
          currentValue: '1.0.0',
          newValue: '1.0.1',
        },
      });

      expect(res).toEqual(
        codeBlock`libraryDependencies += "org.example" %% "foo" % "1.0.1"`,
      );
    });

    it('should update version when scope is present', () => {
      const simpleContent = codeBlock`libraryDependencies += "org.example" %% "foo" % "1.0.0" % Test`;

      const res = sbtUpdater.updateDependency({
        fileContent: simpleContent,
        upgrade: {
          depName: 'org.example:foo',
          currentValue: '1.0.0',
          newValue: '1.0.1',
        },
      });

      expect(res).toEqual(
        codeBlock`libraryDependencies += "org.example" %% "foo" % "1.0.1" % Test`,
      );
    });

    it('should update version when classifier is present', () => {
      const simpleContent = codeBlock`libraryDependencies += ("org.example" %% "foo" % "1.0.0" classifier "sources") % Test`;

      const res = sbtUpdater.updateDependency({
        fileContent: simpleContent,
        upgrade: {
          depName: 'org.example:foo',
          currentValue: '1.0.0',
          newValue: '1.0.1',
        },
      });

      expect(res).toEqual(
        codeBlock`libraryDependencies += ("org.example" %% "foo" % "1.0.1" classifier "sources") % Test`,
      );
    });

    it('should update version in sbt plugins', () => {
      const simpleContent = codeBlock`addSbtPlugin("org.example" % "foo" % "1.0.0")`;

      const res = sbtUpdater.updateDependency({
        fileContent: simpleContent,
        upgrade: {
          depName: 'org.example:foo',
          currentValue: '1.0.0',
          newValue: '1.0.1',
        },
      });

      expect(res).toEqual(
        codeBlock`addSbtPlugin("org.example" % "foo" % "1.0.1")`,
      );
    });

    it('should update version outside of libraryDependencies as well', () => {
      const simpleContent = codeBlock`dependencyOverrides += "org.example" %% "foo" % "1.0.0" % Test`;

      const res = sbtUpdater.updateDependency({
        fileContent: simpleContent,
        upgrade: {
          depName: 'org.example:foo',
          currentValue: '1.0.0',
          newValue: '1.0.1',
        },
      });

      expect(res).toEqual(
        codeBlock`dependencyOverrides += "org.example" %% "foo" % "1.0.1" % Test`,
      );
    });

    it('should update version in a sequence', () => {
      const simpleContent = codeBlock`
      libraryDependencies ++= Seq(
        "org.example" %% "foo" % "1.0.0",
        "org.example" %% "bar" % "1.0.0",
      )
      `;

      const res = sbtUpdater.updateDependency({
        fileContent: simpleContent,
        upgrade: {
          depName: 'org.example:foo',
          currentValue: '1.0.0',
          newValue: '1.0.1',
        },
      });

      expect(res).toEqual(
        codeBlock`
        libraryDependencies ++= Seq(
          "org.example" %% "foo" % "1.0.1",
          "org.example" %% "bar" % "1.0.0",
        )`,
      );
    });

    it('should update version with shared variable', () => {
      const simpleContent = codeBlock`
      val someVersion = "1.0.0"
      libraryDependencies += "org.example" %% "foo" % someVersion
      `;

      const res = sbtUpdater.updateDependency({
        fileContent: simpleContent,
        upgrade: {
          depName: 'org.example:foo',
          currentValue: '1.0.0',
          newValue: '1.0.1',
          sharedVariableName: 'someVersion',
        },
      });

      expect(res).toEqual(
        codeBlock`
        val someVersion = "1.0.1"
        libraryDependencies += "org.example" %% "foo" % someVersion
        `,
      );
    });

    it('should update version with typed shared variable', () => {
      const simpleContent = codeBlock`
      val someVersion: String = "1.0.0"
      libraryDependencies += "org.example" %% "foo" % someVersion
      `;

      const res = sbtUpdater.updateDependency({
        fileContent: simpleContent,
        upgrade: {
          depName: 'org.example:foo',
          currentValue: '1.0.0',
          newValue: '1.0.1',
          sharedVariableName: 'someVersion',
        },
      });

      expect(res).toEqual(
        codeBlock`
        val someVersion: String = "1.0.1"
        libraryDependencies += "org.example" %% "foo" % someVersion
        `,
      );
    });

    it('should update version in case of Java library (single %)', () => {
      const simpleContent = codeBlock`libraryDependencies += "org.example" % "foo" % "1.0.0"`;

      const res = sbtUpdater.updateDependency({
        fileContent: simpleContent,
        upgrade: {
          depName: 'org.example:foo',
          currentValue: '1.0.0',
          newValue: '1.0.1',
        },
      });

      expect(res).toEqual(
        codeBlock`libraryDependencies += "org.example" % "foo" % "1.0.1"`,
      );
    });

    it('should update version in case of cross dependency (triple %)', () => {
      const simpleContent = codeBlock`libraryDependencies += "org.example" %%% "foo" % "1.0.0"`;

      const res = sbtUpdater.updateDependency({
        fileContent: simpleContent,
        upgrade: {
          depName: 'org.example:foo',
          currentValue: '1.0.0',
          newValue: '1.0.1',
        },
      });

      expect(res).toEqual(
        codeBlock`libraryDependencies += "org.example" %%% "foo" % "1.0.1"`,
      );
    });

    it('should update version if there are comments on the line', () => {
      const simpleContent = codeBlock`libraryDependencies += "org.example" %% "foo" % "1.0.0" // some comment`;

      const res = sbtUpdater.updateDependency({
        fileContent: simpleContent,
        upgrade: {
          depName: 'org.example:foo',
          currentValue: '1.0.0',
          newValue: '1.0.1',
        },
      });

      expect(res).toEqual(
        codeBlock`libraryDependencies += "org.example" %% "foo" % "1.0.1" // some comment`,
      );
    });

    it('should update version if duplicated', () => {
      const simpleContent = codeBlock`
      libraryDependencies += "org.example" %% "foo" % "1.0.0",
      libraryDependencies += "org.example" %% "foo" % "1.0.0"
      `;

      const res = sbtUpdater.updateDependency({
        fileContent: simpleContent,
        upgrade: {
          depName: 'org.example:foo',
          currentValue: '1.0.0',
          newValue: '1.0.1',
        },
      });

      expect(res).toEqual(
        codeBlock`
        libraryDependencies += "org.example" %% "foo" % "1.0.1",
        libraryDependencies += "org.example" %% "foo" % "1.0.1"
        `,
      );
    });

    it('should do replacement with new value', () => {
      const simpleContent = codeBlock`libraryDependencies += "org.scalatestplus" %% "mockito-3-12" % "3.2.10.0"`;

      fs.writeLocalFile.mockResolvedValueOnce();

      const res = sbtUpdater.updateDependency({
        fileContent: simpleContent,
        upgrade: {
          updateType: 'replacement',
          depName: 'org.scalatestplus:mockito-3-12',
          currentValue: '3.2.10.0',
          newName: 'org.scalatestplus.new:mockito-4-11',
          newValue: '3.3.0.0',
        },
      });

      expect(res).toEqual(
        codeBlock`libraryDependencies += "org.scalatestplus.new" %% "mockito-4-11" % "3.3.0.0"`,
      );
    });

    it('should do replacement without a new value', () => {
      const simpleContent = codeBlock`libraryDependencies += "org.scalatestplus" %% "mockito-3-12" % "3.2.10.0"`;

      const res = sbtUpdater.updateDependency({
        fileContent: simpleContent,
        upgrade: {
          updateType: 'replacement',
          depName: 'org.scalatestplus:mockito-3-12',
          currentValue: '3.2.10.0',
          newName: 'org.scalatestplus.new:mockito-4-11',
        },
      });

      expect(res).toEqual(
        codeBlock`libraryDependencies += "org.scalatestplus.new" %% "mockito-4-11" % "3.2.10.0"`,
      );
    });

    it('should do replacement for Java library as well (single %)', () => {
      const simpleContent = codeBlock`libraryDependencies += "com.fasterxml.jackson" % "jackson-bom" % "2.20.0"`;

      const res = sbtUpdater.updateDependency({
        fileContent: simpleContent,
        upgrade: {
          updateType: 'replacement',
          depName: 'com.fasterxml.jackson:jackson-bom',
          currentValue: '2.20.0',
          newName: 'tools.jackson:jackson-bom-new',
          newValue: '3.0.0',
        },
      });

      expect(res).toEqual(
        codeBlock`libraryDependencies += "tools.jackson" % "jackson-bom-new" % "3.0.0"`,
      );
    });

    it('should do replacement with version as shared variable', () => {
      const simpleContent = codeBlock`
      val someVersion = "3.2.10.0"
      libraryDependencies += "org.scalatestplus" %% "mockito-3-12" % someVersion
      `;

      const res = sbtUpdater.updateDependency({
        fileContent: simpleContent,
        upgrade: {
          updateType: 'replacement',
          depName: 'org.scalatestplus:mockito-3-12',
          currentValue: '3.2.10.0',
          newName: 'org.scalatestplus.new:mockito-4-11',
          newValue: '3.3.0.0',
          sharedVariableName: 'someVersion',
        },
      });

      expect(res).toEqual(
        codeBlock`
      val someVersion = "3.3.0.0"
      libraryDependencies += "org.scalatestplus.new" %% "mockito-4-11" % someVersion
      `,
      );
    });
  });
});
