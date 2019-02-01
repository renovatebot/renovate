module.exports = {
  parse,
};

function parse(input) {
  if (!input) {
    return null;
  }
  const scheme = 'pkg:';
  if (!input.startsWith(scheme)) {
    return null;
  }
  const purl = {};
  let remaining = input.substring(scheme.length);
  let parts = remaining.split('#');
  if (parts.length > 1) {
    [remaining, purl.subpath] = parts;
  }
  parts = remaining.split('?');
  if (parts.length > 1) {
    [remaining, purl.qualifiers] = parts;
  }
  parts = remaining.split('@');
  if (parts.length > 1) {
    [remaining, purl.version] = parts;
  }
  parts = remaining.split('/');
  [purl.type, ...remaining] = parts;
  if (remaining.length === 1) {
    [purl.name] = remaining;
    purl.fullname = purl.name;
  } else {
    purl.name = remaining.pop();
    purl.namespace = remaining.join('/').replace('%40', '@');
    purl.fullname = purl.namespace + '/' + purl.name;
  }
  if (purl.qualifiers) {
    const allQualifiers = purl.qualifiers.split('&');
    purl.qualifiers = {};
    allQualifiers.forEach(qualifier => {
      const [key, val] = qualifier.split('=');
      purl.qualifiers[key] = val;
    });
  } else {
    purl.qualifiers = {};
  }
  const res = {
    datasource: purl.type,
    lookupName: purl.fullname,
  };
  if (purl.qualifiers.repository_url) {
    res.registryUrls = purl.qualifiers.repository_url.split(',');
  }
  if (purl.subpath) {
    res.lookupType = purl.subpath;
  }
  return res;
}
