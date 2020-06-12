import { logger } from '../../logger';
import { Http } from '../../util/http';
import { DatasourceError, Release, ReleaseResult } from '../common';
import { id } from './common';

const http = new Http(id);
const cacheTimeMin = 60;

let lastSync = new Date('2000-01-01');
let packageReleases: Record<string, ReleaseResult> = Object.create(null);

function processPlugin(name: string, data: Record<string, any>): void {
  let releases: Release[] = [data?.previousVersion, data?.version]
    .filter((x) => x !== null && x !== undefined)
    .map((x) => { return { version: x } });

  packageReleases[name] = {
    name: name,
    releases: releases,
    sourceUrl: data?.scm
  };
}

async function updateJenkinsPluginVersions(): Promise<void> {
  const url = 'https://updates.jenkins.io/current/update-center.actual.json';
  const options = {
    headers: {
      'Accept-Encoding': 'gzip, enflate, br'
    },
  };
  let body: string;
  let bodyParsed: Record<string, any>;

  try {
    logger.debug('Jenkins: Fetching Jenkins plugins versions');
    let startTime = Date.now();
    body = (await http.get(url, options)).body;
    let durationMs = Math.round(Date.now() - startTime);
    logger.debug({ durationMs }, 'Jenkins: Fetched Jenkins plugins versions');

    startTime = Date.now();
    bodyParsed = JSON.parse(body);
    durationMs = Math.round(Date.now() - startTime);
    logger.debug({ durationMs }, 'Jenkins: Parsed Jenkins plugins list')
  } catch (err) /* istanbul ignore next */ {
    packageReleases = Object.create(null);
    throw new DatasourceError(
      new Error('Jenkins: Fetch error - need to reset cache')
    );
  }

  (bodyParsed.plugins || []).forEach((pluginData: Record<string, any>,
                                      pluginName: string) => {
    processPlugin(pluginName, pluginData);
  })

  lastSync = new Date();
}

function isDataStale(): boolean {
  const minutesElapsed = Math.floor(
    (new Date().getTime() - lastSync.getTime()) / (60 * 1000)
  );
  return minutesElapsed >= cacheTimeMin;
}

let _updateJenkinsPluginVersions: Promise<void> | undefined;

async function syncVersions(): Promise<void> {
  if (isDataStale()) {
    _updateJenkinsPluginVersions =
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      _updateJenkinsPluginVersions || updateJenkinsPluginVersions();
    await _updateJenkinsPluginVersions;
    _updateJenkinsPluginVersions = null;
  }
}

export async function getJenkinsPluginDependency(
  lookupName: string
): Promise<ReleaseResult | null> {
  logger.debug(`getJenkinsDependency(${lookupName})`);
  await syncVersions();
  if (!packageReleases[lookupName]) {
    return null;
  }

  return packageReleases[lookupName]
}
