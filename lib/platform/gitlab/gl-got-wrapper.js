const URL = require('url');
const got = require('../../util/got');
const delay = require('delay');

const parseLinkHeader = require('parse-link-header');
const hostRules = require('../../util/host-rules');

let endpoint = 'https://gitlab.com/api/v4/';

async function get(path, options, retries = 5) {
  const url = URL.resolve(endpoint, path);
  const opts = {
    ...options,
    ...hostRules.find({ hostType: 'gitlab', url }),
    json: true,
  };
  if (opts.token) {
    opts.headers = {
      ...opts.headers,
      'PRIVATE-TOKEN': opts.token,
    };
    delete opts.token;
  }
  delete opts.endpoint;
  try {
    const res = await got(url, opts);
    if (opts.paginate) {
      // Check if result is paginated
      try {
        const linkHeader = parseLinkHeader(res.headers.link);
        if (linkHeader && linkHeader.next) {
          res.body = res.body.concat(
            (await get(linkHeader.next.url, opts, retries)).body
          );
        }
      } catch (err) /* istanbul ignore next */ {
        logger.warn({ err }, 'Pagination error');
      }
    }
    return res;
  } catch (err) /* istanbul ignore next */ {
    if (retries < 1) {
      throw err;
    }
    if (err.statusCode === 429) {
      logger.info(`Sleeping 1 minute before retrying 429`);
      await delay(60000);
      return get(path, opts, retries - 1);
    }
    throw err;
  }
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

for (const x of helpers) {
  get[x] = (url, opts) =>
    get(url, Object.assign({}, opts, { method: x.toUpperCase() }));
}

get.setEndpoint = e => {
  endpoint = e;
};

module.exports = get;
