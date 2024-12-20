This datasource will return releases from the Cocoapods public CDN by default.

### Private Cocoapods Repositories

It can also be configured to return releases from a private Cocoapods repository via the environment variable `COCOAPODS_GIT_REPOSITORIES` which takes a comma separated list of one or more repository URLs.
These URLs should be exactly the same as what is in the Podfile of your project like so:

Podfile:

```ruby
source 'https://myorg.visualstudio.com/myproject/_git/podspecs'
source 'https://cdn.cocoapods.org/'

target 'MyApp' do
  pod 'RxSwift' # Comes from 'https://cdn.cocoapods.org'
  pod 'MyPrivatePod' # Comes from 'https://myorg.visualstudio.com/myproject/_git/podspecs'
end
```

config.js:

```javascript
module.exports = {
  platform: "azure",
  endpoint: "https://myorg.visualstudio.com",
  token: process.env.TOKEN,
  COCOAPODS_GIT_REPOSITORIES: "https://myorg.visualstudio.com/myproject/_git/podspecs",
  repositories: [
    "myproject/my-mobile-app",
  ],
  packageRules: [
    {
      "matchDatasources": ["pod"],
      "matchPackageNames": ["MyPrivatePod"]
    }
  ]
};
```
