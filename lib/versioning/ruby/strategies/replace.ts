import { satisfies } from '@snyk/ruby-semver';
import bump from './bump';

export default ({ to, range }: { range: string; to: string }): string => {
  if (satisfies(to, range)) {
    return range;
  }
  const lastPart = range
    .split(',')
    .map(part => part.trim())
    .pop();
  const lastPartPrecision = lastPart.split('.').length;
  const toPrecision = to.split('.').length;
  let massagedTo: string = to;
  if (!lastPart.startsWith('<') && toPrecision > lastPartPrecision) {
    massagedTo = to
      .split('.')
      .slice(0, lastPartPrecision)
      .join('.');
  }
  const newLastPart = bump({ to: massagedTo, range: lastPart });
  return range.replace(lastPart, newLastPart);
};
