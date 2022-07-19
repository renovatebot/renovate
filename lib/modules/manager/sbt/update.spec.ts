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
        'patch'
      );

      expect(bumpedContent).toEqual(content.replace('0.0.2', '0.0.3'));
      expect(bumpedContent).not.toEqual(content);
    });

    it('no ops', () => {
      const { bumpedContent } = sbtUpdater.bumpPackageVersion(
        content,
        '0.0.1',
        'patch'
      );

      expect(bumpedContent).toEqual(content);
    });

    it('updates', () => {
      const { bumpedContent } = sbtUpdater.bumpPackageVersion(
        content,
        '0.0.1',
        'minor'
      );
      expect(bumpedContent).toEqual(content.replace('0.0.2', '0.1.0'));
      expect(bumpedContent).not.toEqual(content);
    });

    it('returns content if bumping errors', () => {
      const { bumpedContent } = sbtUpdater.bumpPackageVersion(
        content,
        '0.0.2',
        true as any
      );

      expect(bumpedContent).toEqual(content);
    });

    it('update project/Versions.scala', () => {
      const versionFile = `object Versions {
        object Company {
          val testlib    = "0.2.1"
        }
      }
      `;
      const updatedVersionFile = `object Versions {
        object Company {
          val testlib    = "0.2.2"
        }
      }
      `;
      const bumpedContent = sbtUpdater.updateDependency({
        fileContent: versionFile,
        upgrade: {
          fileReplacePosition: 2,
          currentValue: '0.2.1',
          newValue: '0.2.2',
          newVersion: '0.2.2',
        },
      });

      expect(bumpedContent).toEqual(updatedVersionFile);
    });

    it('update build.sbt', () => {
      const versionFile = `
      lazy val root = project.in(file("."))
        .settings(noPublishSettings ++ Seq(
          libraryDependencies ++= Seq(
            "ch.qos.logback"    % "logback-classic"       % "1.2.11"
          )
        ))
      `;
      const updatedVersionFile = `
      lazy val root = project.in(file("."))
        .settings(noPublishSettings ++ Seq(
          libraryDependencies ++= Seq(
            "ch.qos.logback"    % "logback-classic"       % "1.2.12"
          )
        ))
      `;
      const bumpedContent = sbtUpdater.updateDependency({
        fileContent: versionFile,
        upgrade: {
          currentValue: '1.2.11',
          newValue: '1.2.12',
          newVersion: '1.2.12',
        },
      });

      expect(bumpedContent).toEqual(updatedVersionFile);
    });
  });
});
