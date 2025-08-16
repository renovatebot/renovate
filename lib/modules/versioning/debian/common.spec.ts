import dataFiles from '../../../data-files.generated';
import { logger } from '../../../logger';
import { DistroInfo } from '../distro';
import { RollingReleasesData } from './common';

describe('modules/versioning/debian/common', () => {
  it('no rolling release data', () => {
    dataFiles.set('data/debian-distro-info.json', '{}');

    const distroInfo = new DistroInfo('data/debian-distro-info.json');
    const rollingReleases = new RollingReleasesData(distroInfo);

    expect(rollingReleases.has('buster')).toBeFalse();
    expect(rollingReleases.has('trixie')).toBeFalse();
    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(
      'RollingReleasesData - data written',
    );
  });
});
