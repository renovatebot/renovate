import { satisfies } from '@snyk/ruby-semver';
import bump from './bump';

export default ({ to, range }) => {
  if (satisfies(to, range)) {
    return range;
  }
  const lastPart = range
    .split(',')
    .map(part => part.trim())
    .pop();
  const newLastPart = bump({ to, range: lastPart });
  // TODO: match precision
  return range.replace(lastPart, newLastPart);
};
