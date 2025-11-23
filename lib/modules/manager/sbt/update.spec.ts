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
    it('should do replacement with new value', async () => {
      const simpleContent = `libraryDependencies += "org.scalatestplus" %% "mockito-3-12" % "3.2.10.0"`;

      const res = await sbtUpdater.updateDependency({
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
        'libraryDependencies += "org.scalatestplus.new" %% "mockito-4-11" % "3.3.0.0"',
      );
    });

    it('should do replacement without a new value', async () => {
      const simpleContent = `libraryDependencies += "org.scalatestplus" %% "mockito-3-12" % "3.2.10.0"`;

      const res = await sbtUpdater.updateDependency({
        fileContent: simpleContent,
        upgrade: {
          updateType: 'replacement',
          depName: 'org.scalatestplus:mockito-3-12',
          currentValue: '3.2.10.0',
          newName: 'org.scalatestplus.new:mockito-4-11',
        },
      });

      expect(res).toEqual(
        'libraryDependencies += "org.scalatestplus.new" %% "mockito-4-11" % "3.2.10.0"',
      );
    });

    it('should do replacement for Java library as well (single %)', async () => {
      const simpleContent = `libraryDependencies += "com.fasterxml.jackson" % "jackson-bom" % "2.20.0"`;

      const res = await sbtUpdater.updateDependency({
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
        'libraryDependencies += "tools.jackson" % "jackson-bom-new" % "3.0.0"',
      );
    });

    it('should do replacement with version as shared variable', async () => {
      const simpleContent = `
      val someVersion = "3.2.10.0"
      libraryDependencies += "org.scalatestplus" %% "mockito-3-12" % someVersion
      `;

      const res = await sbtUpdater.updateDependency({
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
        `
      val someVersion = "3.3.0.0"
      libraryDependencies += "org.scalatestplus.new" %% "mockito-4-11" % someVersion
      `,
      );
    });
  });
});
