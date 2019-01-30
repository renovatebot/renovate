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
  [purl.datasource, ...remaining] = parts;
  if (remaining.length === 1) {
    [purl.name] = remaining;
    purl.lookupName = purl.name;
  } else {
    purl.name = remaining.pop();
    purl.namespace = remaining.join('/').replace('%40', '@');
    purl.lookupName = purl.namespace + '/' + purl.name;
  }
  if (purl.qualifiers) {
    const allQualifiers = purl.qualifiers.split('&');
    purl.qualifiers = {};
    allQualifiers.forEach(qualifier => {
      const [key, val] = qualifier.split('=');
      purl.qualifiers[key] = val;
    });
    if (purl.qualifiers.repository_url) {
      purl.registryUrls = purl.qualifiers.repository_url.split(',');
      delete purl.qualifiers.repository_url;
    }
  } else {
    purl.qualifiers = {};
  }
  if (purl.subpath) {
    purl.lookupType = purl.subpath;
    delete purl.subpath;
  }
  delete purl.namespace;
  delete purl.name;
  delete purl.version; // we don't use it
  return purl;
}
