const fs = require('fs');

const yarnLock = fs.readFileSync('./yarn.lock').toString();
console.log(yarnLock);
/*
let yarnPackages = yarnLock.match(/[^\s]+:/ig);
yarnPackages = yarnPackages.filter(pkg => pkg.indexOf('@') !== -1);
yarnPackages = yarnPackages.map(pkg => pkg.replace(/"/g, '').replace(':', ''));
yarnPackages.forEach((entry) => {
  const atLocation = entry.indexOf('@', 1);
  const pkgName = entry.substring(0, atLocation);
  const version =
});
console.log(JSON.stringify(yarnPackages));
*/
