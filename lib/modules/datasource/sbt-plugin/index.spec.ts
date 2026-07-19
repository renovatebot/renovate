import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { regEx } from '../../../util/regex.ts';
import * as mavenVersioning from '../../versioning/maven/index.ts';
import { getPkgReleases } from '../index.ts';
import { MAVEN_REPO } from '../maven/common.ts';
import { extractPageLinks } from '../sbt-package/util.ts';
import { SbtPluginDatasource } from './index.ts';

const mavenIndexHtml = Fixtures.get(`maven-index.html`);
const sbtPluginIndex = Fixtures.get(`sbt-plugins-index.html`);

describe('modules/datasource/sbt-plugin/index', () => {
  it('parses Maven index directory', () => {
    expect(
      extractPageLinks(mavenIndexHtml, (x) =>
        regEx(/^\.+/).test(x) ? null : x,
      ),
    ).toEqual([
      'autofix-3.0.6_2.11',
      'autofix-3.0.6_2.12',
      'autofix-3.0.8_2.11',
      'autofix-3.0.8_2.12',
      'scalatest',
      'scalatest-all_2.10',
      'scalatest-all_2.11',
      'scalatest-all_sjs0.6_2.10',
      'scalatest-all_sjs0.6_2.11',
      'scalatest-app_2.10',
      'scalatest-app_2.11',
      'scalatest-app_2.12',
      'scalatest-app_2.12.0-M3',
      'scalatest-app_2.12.0-M4',
      'scalatest-app_2.12.0-M5',
      'scalatest-app_2.12.0-RC1',
      'scalatest-app_2.12.0-RC2',
      'scalatest-app_2.13.0-M1',
      'scalatest-app_2.13.0-M2',
      'scalatest-app_2.13.0-M3',
      'scalatest-app_2.13.0-M4',
      'scalatest-app_2.13.0-M5',
      'scalatest-app_2.13.0-RC1',
      'scalatest-app_2.13.0-RC2',
      'scalatest-app_native0.3_2.11',
      'scalatest-app_sjs0.6_2.10',
      'scalatest-app_sjs0.6_2.11',
      'scalatest-app_sjs0.6_2.12',
      'scalatest-app_sjs0.6_2.12.0-M3',
      'scalatest-app_sjs0.6_2.12.0-M4',
      'scalatest-app_sjs0.6_2.12.0-M5',
      'scalatest-app_sjs0.6_2.12.0-RC1',
      'scalatest-app_sjs0.6_2.12.0-RC2',
      'scalatest-app_sjs0.6_2.13.0-M1',
      'scalatest-app_sjs0.6_2.13.0-M2',
      'scalatest-app_sjs0.6_2.13.0-M3',
      'scalatest-app_sjs0.6_2.13.0-M4',
      'scalatest-app_sjs0.6_2.13.0-M5',
      'scalatest-app_sjs0.6_2.13.0-RC1',
      'scalatest-app_sjs0.6_2.13.0-RC2',
      'scalatest-app_sjs1.0.0-M3_2.11',
      'scalatest-app_sjs1.0.0-M3_2.12',
      'scalatest-app_sjs1.0.0-M7_2.11',
      'scalatest-app_sjs1.0.0-M7_2.12',
      'scalatest-app_sjs1.0.0-M7_2.13.0-RC1',
      'scalatest-app_sjs1.0.0-M7_2.13.0-RC2',
      'scalatest-core_2.10',
      'scalatest-core_2.11',
      'scalatest-core_sjs0.6_2.10',
      'scalatest-core_sjs0.6_2.11',
      'scalatest-easymock_2.10',
      'scalatest-easymock_2.11',
      'scalatest-featurespec_2.10',
      'scalatest-featurespec_2.11',
      'scalatest-featurespec_sjs0.6_2.10',
      'scalatest-featurespec_sjs0.6_2.11',
      'scalatest-finders',
      'scalatest-finders_2.9.0',
      'scalatest-flatspec_2.10',
      'scalatest-flatspec_2.11',
      'scalatest-flatspec_sjs0.6_2.10',
      'scalatest-flatspec_sjs0.6_2.11',
      'scalatest-freespec_2.10',
      'scalatest-freespec_2.11',
      'scalatest-freespec_sjs0.6_2.10',
      'scalatest-freespec_sjs0.6_2.11',
      'scalatest-funspec_2.10',
      'scalatest-funspec_2.11',
      'scalatest-funspec_sjs0.6_2.10',
      'scalatest-funspec_sjs0.6_2.11',
      'scalatest-funsuite_2.10',
      'scalatest-funsuite_2.11',
      'scalatest-funsuite_sjs0.6_2.10',
      'scalatest-funsuite_sjs0.6_2.11',
      'scalatest-jmock_2.10',
      'scalatest-jmock_2.11',
      'scalatest-junit_2.10',
      'scalatest-junit_2.11',
      'scalatest-matchers-core_2.10',
      'scalatest-matchers-core_2.11',
      'scalatest-matchers-core_sjs0.6_2.10',
      'scalatest-matchers-core_sjs0.6_2.11',
      'scalatest-matchers_2.10',
      'scalatest-matchers_2.11',
      'scalatest-matchers_sjs0.6_2.10',
      'scalatest-matchers_sjs0.6_2.11',
      'scalatest-maven-plugin',
      'scalatest-mustmatchers_2.10',
      'scalatest-mustmatchers_2.11',
      'scalatest-mustmatchers_sjs0.6_2.10',
      'scalatest-mustmatchers_sjs0.6_2.11',
      'scalatest-propspec_2.10',
      'scalatest-propspec_2.11',
      'scalatest-propspec_sjs0.6_2.10',
      'scalatest-propspec_sjs0.6_2.11',
      'scalatest-refspec_2.10',
      'scalatest-refspec_2.11',
      'scalatest-selenium_2.10',
      'scalatest-selenium_2.11',
      'scalatest-testng_2.10',
      'scalatest-testng_2.11',
      'scalatest-wordspec_2.10',
      'scalatest-wordspec_2.11',
      'scalatest-wordspec_sjs0.6_2.10',
      'scalatest-wordspec_sjs0.6_2.11',
      'scalatest_2.10',
      'scalatest_2.10.0',
      'scalatest_2.10.0-M4',
      'scalatest_2.10.0-M5',
      'scalatest_2.10.0-M6',
      'scalatest_2.10.0-M7',
      'scalatest_2.10.0-RC1',
      'scalatest_2.10.0-RC2',
      'scalatest_2.10.0-RC3',
      'scalatest_2.10.0-RC5',
      'scalatest_2.11',
      'scalatest_2.11.0-M3',
      'scalatest_2.11.0-M4',
      'scalatest_2.11.0-M5',
      'scalatest_2.11.0-M7',
      'scalatest_2.11.0-M8',
      'scalatest_2.11.0-RC1',
      'scalatest_2.11.0-RC2',
      'scalatest_2.11.0-RC3',
      'scalatest_2.11.0-RC4',
      'scalatest_2.12',
      'scalatest_2.12.0-M1',
      'scalatest_2.12.0-M2',
      'scalatest_2.12.0-M3',
      'scalatest_2.12.0-M4',
      'scalatest_2.12.0-M5',
      'scalatest_2.12.0-RC1',
      'scalatest_2.12.0-RC2',
      'scalatest_2.13.0-M1',
      'scalatest_2.13.0-M2',
      'scalatest_2.13.0-M3',
      'scalatest_2.13.0-M4',
      'scalatest_2.13.0-M5',
      'scalatest_2.13.0-RC1',
      'scalatest_2.13.0-RC2',
      'scalatest_2.8.0',
      'scalatest_2.8.1',
      'scalatest_2.8.2',
      'scalatest_2.9.0',
      'scalatest_2.9.0-1',
      'scalatest_2.9.0.RC3',
      'scalatest_2.9.0.RC4',
      'scalatest_2.9.1',
      'scalatest_2.9.1-1',
      'scalatest_2.9.1-1-RC1',
      'scalatest_2.9.2',
      'scalatest_2.9.3',
      'scalatest_2.9.3-RC1',
      'scalatest_2.9.3-RC2',
      'scalatest_native0.3_2.11',
      'scalatest_sjs0.6_2.10',
      'scalatest_sjs0.6_2.11',
      'scalatest_sjs0.6_2.12',
      'scalatest_sjs0.6_2.12.0-M3',
      'scalatest_sjs0.6_2.12.0-M4',
      'scalatest_sjs0.6_2.12.0-M5',
      'scalatest_sjs0.6_2.12.0-RC1',
      'scalatest_sjs0.6_2.12.0-RC2',
      'scalatest_sjs0.6_2.13.0-M1',
      'scalatest_sjs0.6_2.13.0-M2',
      'scalatest_sjs0.6_2.13.0-M3',
      'scalatest_sjs0.6_2.13.0-M4',
      'scalatest_sjs0.6_2.13.0-M5',
      'scalatest_sjs0.6_2.13.0-RC1',
      'scalatest_sjs0.6_2.13.0-RC2',
      'scalatest_sjs1.0.0-M3_2.11',
      'scalatest_sjs1.0.0-M3_2.12',
      'scalatest_sjs1.0.0-M7_2.11',
      'scalatest_sjs1.0.0-M7_2.12',
      'scalatest_sjs1.0.0-M7_2.13.0-RC1',
      'scalatest_sjs1.0.0-M7_2.13.0-RC2',
      'scalatestjs_sjs0.6_2.10',
      'scalatestjs_sjs0.6_2.11',
      'scalatestjs_sjs0.6_2.12',
      'scalatestjs_sjs0.6_2.13.0-M4',
      'scalatestjs_sjs1.0.0-M3_2.11',
      'scalatestjs_sjs1.0.0-M3_2.12',
      'test-interface',
    ]);
  });

  it('parses sbt index directory', () => {
    expect(
      extractPageLinks(sbtPluginIndex, (x) =>
        regEx(/^\.+/).test(x) ? null : x,
      ),
    ).toEqual([
      'au.com.onegeek',
      'bavadim',
      'be.venneborg.sbt',
      'biz.cgta',
      'br.com.handit',
      'cc.spray',
      'ch.epfl.scala.index',
      'ch.epfl.scala',
      'ch.jodersky',
      'ch.wavein',
      'ch',
      'chainkite',
      'co.vitaler',
      'co',
      'codes.reactive.sbt',
      'com.adelegue',
      'com.agilogy',
      'com.alpeb',
      'com.anadeainc',
      'com.aol.sbt',
      'com.benmccann',
      'com.bicou.sbt',
      'com.birdhowl',
      'com.blstream',
      'com.bowlingx',
      'com.byteground',
      'com.cavorite',
      'com.cedware',
      'com.clever-age',
      'com.codecommit',
      'com.culpin.team',
      'com.dancingcode',
      'com.databricks',
      'com.dayslar.play',
      'com.dispalt.pop',
      'com.dispalt.relay',
      'com.dscleaver.sbt',
      'com.dslplatform',
      'com.dwijnand.sbtprojectgraph',
      'com.dwijnand',
      'com.earldouglas',
      'com.eed3si9n',
      'com.eltimn',
      'com.esdrasbeleza',
      'com.evenfinancial',
      'com.geezeo',
      'com.geirsson',
      'com.gilt.sbt',
      'com.github.DavidPerezIngeniero',
      'com.github.aafa',
      'com.github.ahjohannessen',
      'com.github.akiomik',
      'com.github.bootlog',
      'com.github.casualjim',
      'com.github.catap',
      'com.github.cb372',
      'com.github.citrum.webby',
      'com.github.crakjie',
      'com.github.cuzfrog',
      'com.github.daniel-shuy',
      'com.github.davidpeklak',
      'com.github.ddispaltro',
      'com.github.dwhjames',
      'com.github.dwickern',
      'com.github.gpgekko',
      'com.github.gseitz',
      'com.github.inthenow',
      'com.github.izhangzhihao',
      'com.github.jeffreyolchovy',
      'com.github.jodersky',
      'com.github.marceloemanoel',
      'com.github.masseguillaume',
      'com.github.mkroli',
      'com.github.mmizutani',
      'com.github.mvallerie',
      'com.github.mwz',
      'com.github.nyavro',
      'com.github.pinguinson',
      'com.github.play2war',
      'com.github.plippe',
      'com.github.qualysis',
      'com.github.retronym',
      'com.github.saint1991',
      'com.github.saurfang',
      'com.github.sbt',
      'com.github.shanbin',
      'com.github.shmishleniy',
      'com.github.stonexx.sbt',
      'com.github.tptodorov',
      'com.github.wookietreiber',
      'com.github.zainab-ali',
      'com.glngn',
      'com.googlecode.sbt-rats',
      'com.gu',
      'com.hanhuy.sbt',
      'com.heroku',
      'com.hevylight',
      'com.hootsuite',
      'com.hpe.sbt',
      'com.iheart',
      'com.impactua',
      'com.jamesneve',
      'com.jamesward',
      'com.jatescher',
      'com.jm2dev',
      'com.jmparsons.sbt',
      'com.jmparsons',
      'com.joescii',
      'com.joshcough',
      'com.jsuereth',
      'com.kailuowang',
      'com.kalmanb.sbt',
      'com.lenioapp',
      'com.lightbend.akka.grpc',
      'com.lightbend.akka',
      'com.lightbend.conductr',
      'com.lightbend.lagom',
      'com.lightbend.paradox',
      'com.lightbend.rp',
      'com.lightbend.sbt',
      'com.lightbend',
      'com.linkedin.sbt-restli',
      'com.localytics',
      'com.mariussoutier.sbt',
      'com.markatta',
      'com.micronautics',
      'com.mintbeans',
      'com.mojolly.scalate',
      'com.nike.redwiggler.sbt',
      'com.novocode',
      'com.olaq',
      'com.oliverlockwood',
      'com.omervk',
      'com.opi.lil',
      'com.oradian.sbt',
      'com.qonceptual.sbt',
      'com.quadstingray',
      'com.rberenguel',
      'com.roperzh.sbt',
      'com.saikocat',
      'com.sc.sbt',
      'com.scalakata.metadoc',
      'com.scalakata',
      'com.scalapenos',
      'com.seroperson',
      'com.servicerocket',
      'com.simianquant',
      'com.simplytyped',
      'com.sirocchj',
      'com.sksamuel.sbt-versions',
      'com.sksamuel.scala-scales',
      'com.sksamuel.scapegoat',
      'com.sksamuel.scoverage',
      'com.sksamuel.scribble',
      'com.sohoffice',
      'com.swoval',
      'com.tapad.sbt',
      'com.teambytes.sbt',
      'com.thesamet',
      'com.thoughtworks',
      'com.timushev.sbt',
      'com.tmzint.sbt',
      'com.trafficland',
      'com.twitter',
      'com.typelead',
      'com.typesafe.akka',
      'com.typesafe.conductr',
      'com.typesafe.play',
      'com.typesafe.reactiveruntime',
      'com.typesafe.sbt',
      'com.typesafe.sbteclipse',
      'com.typesafe.tmp',
      'com.typesafe.typesafeconductr',
      'com.typesafe',
      'com.untyped',
      'com.vmunier',
      'com.xvyg',
      'com.yetu',
      'com.zlad',
      'com',
      'coreyconnor',
      'cuipengfei',
      'de.cbley',
      'de.heikoseeberger',
      'de.jerman',
      'de.johoop',
      'de.knutwalker',
      'de.mediacluster.sbt',
      'de.oakgrove',
      'de.sciss',
      'edu.umass.cs',
      'ee.risk.sbt.plugins',
      'emchristiansen',
      'es.webet.play',
      'es.webet.sbt',
      'eu.arthepsy.sbt',
      'eu.getintheloop',
      'eu.svez',
      'fi.jumi.sbt',
      'fi.onesto.sbt',
      'g00dnatur3',
      'github.com',
      'glngn',
      'im.actor',
      'im.dlg',
      'in.drajit.sbt',
      'info.pdalpra',
      'io.buildo',
      'io.dapas',
      'io.finstack',
      'io.gatling.frontline',
      'io.gatling',
      'io.github.chikei',
      'io.github.darkyenus',
      'io.github.davidgregory084',
      'io.github.henders',
      'io.github.jeremyrsmith',
      'io.github.sugakandrey',
      'io.jenner',
      'io.kamon',
      'io.methvin',
      'io.michaelallen.mustache',
      'io.prediction',
      'io.regadas',
      'io.scalac',
      'io.shaka',
      'io.spray',
      'io.strd.build',
      'io.sysa',
      'io.teamscala.sbt',
      'io.xogus',
      'io.zastoupil',
      'io.zman',
      'it.paperdragon',
      'jsuereth',
      'kevinlee',
      'laughedelic',
      'lt.dvim.authors',
      'lt.dvim.paradox',
      'me.amanj',
      'me.andreionut',
      'me.lessis',
      'me.paulschwarz',
      'me.penkov',
      'me.rschatz',
      'me.tfeng.sbt-plugins',
      'me.vican.jorge',
      'me',
      'mrken',
      'name.de-vries',
      'name.heikoseeberger.groll',
      'name.heikoseeberger.sbt.groll',
      'name.heikoseeberger.sbt.properties',
      'name.heikoseeberger',
      'net.aichler',
      'net.bytebuddy',
      'net.bzzt',
      'net.contentobjects.jnotify',
      'net.eamelink.sbt',
      'net.eigenvalue',
      'net.ground5hark.sbt',
      'net.katsstuff',
      'net.lullabyte',
      'net.nornagon',
      'net.pishen',
      'net.ssanj',
      'net.thunderklaus',
      'net.virtual-void',
      'nl.anchormen.sbt',
      'nl.codestar',
      'nz.co.bottech',
      'ohnosequences',
      'org.aleastChs',
      'org.allenai.plugins',
      'org.bitbucket.inkytonik.sbt-rats',
      'org.bjason',
      'org.clapper',
      'org.cmj',
      'org.coursera.courier',
      'org.coursera.naptime',
      'org.doolse',
      'org.duhemm',
      'org.foundweekends.conscript',
      'org.foundweekends.giter8',
      'org.foundweekends',
      'org.github.ngbinh',
      'org.h3nk3',
      'org.hypercomp',
      'org.irundaia.sbt',
      'org.jetbrains.teamcity.plugins',
      'org.jetbrains',
      'org.jruby',
      'org.lifty',
      'org.lyranthe.sbt',
      'org.madoushi.sbt',
      'org.make',
      'org.neolin.sbt',
      'org.netbeans.nbsbt',
      'org.opencommercesearch',
      'org.pitest.sbt',
      'org.planet42',
      'org.portable-scala',
      'org.roboscala',
      'org.scala-android',
      'org.scala-js',
      'org.scala-lang.modules.scalajs',
      'org.scala-lang.modules',
      'org.scala-native',
      'org.scala-sbt.plugins',
      'org.scala-sbt',
      'org.scalameta',
      'org.scalastyle',
      'org.scalatra.requirejs',
      'org.scalatra.sbt',
      'org.scalavista',
      'org.scoverage',
      'org.tpolecat',
      'org.typelevel',
      'org.zjulambda.scala',
      'org',
      'pl.otrebski',
      'pl.project13.sbt',
      'pl.project13.scala',
      'pl.tues',
      'rocks.muki',
      'ru.dokwork',
      'ru.kotobotov',
      'ru.pravo',
      'sbt-plugin-releases',
      'sbt',
      'scalajs-react-interface',
      'se.sisyfosdigital.sbt',
      'se.yobriefca',
      'securesocial',
      'spartakus',
      'sqlpt',
      'stejskal',
      'tech.ant8e',
      'ub-interactive',
      'uk.co.josephearl',
      'uk.co.randomcoding',
      'works.mesh',
      'woshilaiceshide',
    ]);
  });

  it('uses proper hostType', () => {
    const ds = new SbtPluginDatasource();
    expect(ds).toMatchObject({
      id: SbtPluginDatasource.id,
      http: { hostType: 'sbt' },
    });
  });

  describe('getPkgReleases', () => {
    it('returns null in case of errors', async () => {
      httpMock
        .scope('https://failed_repo/maven/')
        .get('/org/scalatest/')
        .reply(404)
        .get('/org/scalatest/scalatest/')
        .reply(404)
        .get('/org.scalatest/')
        .reply(404)
        .get('/org.scalatest/scalatest/')
        .reply(404);

      httpMock
        .scope('https://repo.maven.apache.org/maven2/')
        .get('/org/scalatest/')
        .reply(404)
        .get('/org/scalatest/scalaz/')
        .reply(404);

      httpMock
        .scope('https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases/')
        .get('/org.scalatest/scalaz/')
        .reply(404)
        .get('/org.scalatest/')
        .reply(404)
        .get('/org/scalatest/scalaz/')
        .reply(404)
        .get('/org/scalatest/')
        .reply(404);

      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: SbtPluginDatasource.id,
          packageName: 'org.scalatest:scalatest',
          registryUrls: ['https://failed_repo/maven'],
        }),
      ).toBeNull();
      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: SbtPluginDatasource.id,
          packageName: 'org.scalatest:scalaz',
          registryUrls: [],
        }),
      ).toBeNull();
    });

    it('fetches sbt plugins', async () => {
      httpMock
        .scope('https://repo.maven.apache.org/maven2/')
        .get('/org/foundweekends/sbt-bintray/')
        .reply(
          200,
          codeBlock`
            <html>
              <head> </head>
              <body>
                <pre><a href="../">../</a></pre>
                <pre><a href="scala_2.12/">scala_2.12/</a></pre>
              </body>
            </html>
          `,
        )
        .get('/org/foundweekends/sbt-bintray/scala_2.12/')
        .reply(
          200,
          codeBlock`
            <html>
              <head> </head>
              <body>
                <pre><a href="../">../</a></pre>
                <pre><a href="sbt_1.0/">sbt_1.0/</a></pre>
              </body>
            </html>
          `,
        )
        .get('/org/foundweekends/sbt-bintray/scala_2.12/sbt_1.0/')
        .reply(
          200,
          codeBlock`
            <html>
              <head> </head>
              <body>
                <pre><a href="../">../</a></pre>
                <pre><a href="0.5.5/">0.5.5/</a></pre>
              </body>
            </html>
          `,
        );

      httpMock
        .scope('https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases/')
        .get('/org.foundweekends/sbt-bintray/')
        .reply(404)
        .get('/org.foundweekends/')
        .reply(404)
        .get('/org/foundweekends/sbt-bintray/')
        .reply(404)
        .get('/org/foundweekends/')
        .reply(404);

      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: SbtPluginDatasource.id,
          packageName: 'org.foundweekends:sbt-bintray',
          registryUrls: [],
        }),
      ).toEqual({
        dependencyUrl:
          'https://repo.maven.apache.org/maven2/org/foundweekends/sbt-bintray',
        registryUrl: 'https://repo.maven.apache.org/maven2',
        releases: [{ version: '0.5.5' }],
      });
    });

    it('fetches sbt plugins 2', async () => {
      httpMock
        .scope('https://repo.maven.apache.org/maven2/')
        .get('/org/foundweekends/sbt-bintray/')
        .reply(
          200,
          codeBlock`
            <html>
              <head> </head>
              <body>
                <pre><a href="../">../</a></pre>
                <pre><a href="scala_2.12/">scala_2.12/</a></pre>
              </body>
            </html>
          `,
        )
        .get('/org/foundweekends/sbt-bintray/scala_2.12/')
        .reply(
          200,
          codeBlock`
            <html>
              <head> </head>
              <body>
                <pre><a href="../">../</a></pre>
                <pre><a href="sbt_1.0/">sbt_1.0/</a></pre>
              </body>
            </html>
          `,
        )
        .get('/org/foundweekends/sbt-bintray/scala_2.12/sbt_1.0/')
        .reply(
          200,
          codeBlock`
            <html>
              <head> </head>
              <body>
                <pre><a href="../">../</a></pre>
                <pre><a href="0.5.5/">0.5.5/</a></pre>
              </body>
            </html>
          `,
        );

      httpMock
        .scope('https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases/')
        .get('/org.foundweekends/sbt-bintray/')
        .reply(404)
        .get('/org.foundweekends/')
        .reply(404)
        .get('/org/foundweekends/sbt-bintray/')
        .reply(404)
        .get('/org/foundweekends/')
        .reply(404);

      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: SbtPluginDatasource.id,
          packageName: 'org.foundweekends:sbt-bintray_2.12',
          registryUrls: [],
        }),
      ).toEqual({
        dependencyUrl:
          'https://repo.maven.apache.org/maven2/org/foundweekends/sbt-bintray',
        registryUrl: 'https://repo.maven.apache.org/maven2',
        releases: [{ version: '0.5.5' }],
      });
    });

    it('extracts URL from Maven POM file', async () => {
      httpMock
        .scope('https://repo.maven.apache.org/maven2/')
        .get('/io/get-coursier/')
        .reply(
          200,
          codeBlock`
            <a href="../">../</a>
            <a href="sbt-coursier_2.10_0.13/">sbt-coursier_2.10_0.13/</a>
            <a href="sbt-coursier_2.12_1.0/">sbt-coursier_2.12_1.0/</a>
            <a href="sbt-coursier_2.12_1.0.0-M5/"
              >sbt-coursier_2.12_1.0.0-M5/</a
            >
            <a href="sbt-coursier_2.12_1.0.0-M6/"
              >sbt-coursier_2.12_1.0.0-M6/</a
            >
          `,
        )
        .get('/io/get-coursier/sbt-coursier_2.12_1.0/')
        .reply(
          200,
          codeBlock`
            <a href="2.0.0-RC2/">2.0.0-RC2/</a>
            <a href="2.0.0-RC6-1/">2.0.0-RC6-1/</a>
            <a href="2.0.0-RC6-2/">2.0.0-RC6-2/</a>
            <a href="2.0.0-RC6-6/">2.0.0-RC6-6/</a>
          `,
        )
        .get(
          '/io/get-coursier/sbt-coursier_2.12_1.0/2.0.0-RC6-6/sbt-coursier-2.0.0-RC6-6.pom',
        )
        .reply(
          200,
          codeBlock`
            <project xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://maven.apache.org/POM/4.0.0" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
              <url>https://get-coursier.io/</url>
              <scm>
                <url>https://github.com/coursier/sbt-coursier</url>
              </scm>
            </project>
          `,
        )

        .get('/io/get-coursier/sbt-coursier/')
        .reply(404)
        .get('/io/get-coursier/sbt-coursier_2.10_0.13/')
        .reply(404)
        .get('/io/get-coursier/sbt-coursier_2.12_1.0.0-M5/')
        .reply(404)
        .get('/io/get-coursier/sbt-coursier_2.12_1.0.0-M6/')
        .reply(404)
        .get(
          '/io/get-coursier/sbt-coursier_2.10_0.13/2.0.0-RC6-6/sbt-coursier_2.10_0.13-2.0.0-RC6-6.pom',
        )
        .reply(404)
        .get(
          '/io/get-coursier/sbt-coursier_2.10_0.13/2.0.0-RC6-6/sbt-coursier-2.0.0-RC6-6.pom',
        )
        .reply(404)
        .get(
          '/io/get-coursier/sbt-coursier_2.12_1.0/2.0.0-RC6-6/sbt-coursier_2.12_1.0-2.0.0-RC6-6.pom',
        )
        .reply(404);

      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: SbtPluginDatasource.id,
          packageName: 'io.get-coursier:sbt-coursier',
          registryUrls: [MAVEN_REPO],
        }),
      ).toEqual({
        dependencyUrl:
          'https://repo.maven.apache.org/maven2/io/get-coursier/sbt-coursier',
        registryUrl: 'https://repo.maven.apache.org/maven2',
        releases: [
          { version: '2.0.0-RC2' },
          { version: '2.0.0-RC6-1' },
          { version: '2.0.0-RC6-2' },
          { version: '2.0.0-RC6-6' },
        ],
        homepage: 'https://get-coursier.io/',
        sourceUrl: 'https://github.com/coursier/sbt-coursier',
      });
    });

    it('handles absolute and root relative paths', async () => {
      httpMock
        .scope('https://repo.maven.apache.org/maven2/')
        .get('/io/get-coursier/')
        .reply(
          200,
          codeBlock`
            <a href="https://repo.maven.apache.org/maven2/io/">../</a>
            <a href="https://repo.maven.apache.org/maven2/io/get-coursier/sbt-coursier_2.10_0.13/">sbt-coursier_2.10_0.13/</a>
            <a href="https://repo.maven.apache.org/maven2/io/get-coursier/sbt-coursier_2.12_1.0/">sbt-coursier_2.12_1.0/</a>
            <a href="https://repo.maven.apache.org/maven2/io/get-coursier/sbt-coursier_2.12_1.0.0-M5/">sbt-coursier_2.12_1.0.0-M5/</a>
            <a href="https://repo.maven.apache.org/maven2/io/get-coursier/sbt-coursier_2.12_1.0.0-M6/">sbt-coursier_2.12_1.0.0-M6/</a>`,
        )
        .get('/io/get-coursier/sbt-coursier_2.12_1.0/')
        .reply(
          200,
          codeBlock`
            <a href="https://repo.maven.apache.org/maven2/io/get-coursier/sbt-coursier_2.12_1.0/2.0.0-RC2/">2.0.0-RC2/</a>
            <a href="https://repo.maven.apache.org/maven2/io/get-coursier/sbt-coursier_2.12_1.0/2.0.0-RC6-1/">2.0.0-RC6-1/</a>
            <a href="/maven2/io/get-coursier/sbt-coursier_2.12_1.0/2.0.0-RC6-2/">2.0.0-RC6-2/</a>
            <a href="/maven2/io/get-coursier/sbt-coursier_2.12_1.0/2.0.0-RC6-6/">2.0.0-RC6-6/</a>
          `,
        )
        .get(
          '/io/get-coursier/sbt-coursier_2.12_1.0/2.0.0-RC6-6/sbt-coursier-2.0.0-RC6-6.pom',
        )
        .reply(
          200,
          codeBlock`
            <project xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://maven.apache.org/POM/4.0.0" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
              <url>https://get-coursier.io/</url>
              <scm>
                <url>https://github.com/coursier/sbt-coursier</url>
              </scm>
            </project>
          `,
        )

        .get('/io/get-coursier/sbt-coursier/')
        .reply(404)
        .get('/io/get-coursier/sbt-coursier_2.10_0.13/')
        .reply(404)
        .get('/io/get-coursier/sbt-coursier_2.12_1.0.0-M5/')
        .reply(404)
        .get('/io/get-coursier/sbt-coursier_2.12_1.0.0-M6/')
        .reply(404)
        .get(
          '/io/get-coursier/sbt-coursier_2.10_0.13/2.0.0-RC6-6/sbt-coursier_2.10_0.13-2.0.0-RC6-6.pom',
        )
        .reply(404)
        .get(
          '/io/get-coursier/sbt-coursier_2.10_0.13/2.0.0-RC6-6/sbt-coursier-2.0.0-RC6-6.pom',
        )
        .reply(404)
        .get(
          '/io/get-coursier/sbt-coursier_2.12_1.0/2.0.0-RC6-6/sbt-coursier_2.12_1.0-2.0.0-RC6-6.pom',
        )
        .reply(404);

      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: SbtPluginDatasource.id,
          packageName: 'io.get-coursier:sbt-coursier',
          registryUrls: [MAVEN_REPO],
        }),
      ).toEqual({
        dependencyUrl:
          'https://repo.maven.apache.org/maven2/io/get-coursier/sbt-coursier',
        registryUrl: 'https://repo.maven.apache.org/maven2',
        releases: [
          { version: '2.0.0-RC2' },
          { version: '2.0.0-RC6-1' },
          { version: '2.0.0-RC6-2' },
          { version: '2.0.0-RC6-6' },
        ],
        homepage: 'https://get-coursier.io/',
        sourceUrl: 'https://github.com/coursier/sbt-coursier',
      });
    });
  });
});
