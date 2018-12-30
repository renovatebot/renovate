## Overview

#### Name of package manager

Cocoapods

---

#### What language does this support?

Swift, Objective-C

---

#### Does that language have other (competing?) package managers?

Carthage, Swift Package Manager

## Package File Detection

#### What type of package files and names does it use?

Podfile

---

#### What [fileMatch](https://renovatebot.com/docs/configuration-options/#filematch) pattern(s) should be used?

`['(^|/)Podfile$']`\*

---

#### Is it likely that many users would need to extend this pattern for custom file names?

No

---

#### Is the fileMatch pattern likely to get many "false hits" for files that have nothing to do with package management?

Unlikely

## Parsing and Extraction

#### Can package files have "local" links to each other that need to be resolved?

No

#### Is there reason why package files need to be parsed together (in serial) instead of independently?

No

---

#### What format/syntax is the package file in? e.g. JSON, TOML, custom?

Package file uses ruby syntax.

---

#### How do you suggest parsing the file? Using an off-the-shelf parser, using regex, or can it be custom-parsed line by line?

Using regex

---

#### Does the package file structure distinguish between different "types" of dependencies? e.g. production dependencies, dev dependencies, etc?

It distinguishes dependencies for different targets (testing target, target for TV OS etc)

---

#### List all the sources/syntaxes of dependencies that can be extracted:

Dependency indicated by keyword `pod` and name with version.

Also, it's possible to use a local podspec file on the machine, or in the root of library repo.
In case of the repo you also can specify branch, tag or commit.

```
pod 'AFNetworking', '~> 2.6'
pod 'Alamofire', :path => '~/Documents/Alamofire'
pod 'Alamofire', :git => 'https://github.com/Alamofire/Alamofire.git'
pod 'Alamofire', :git => 'https://github.com/Alamofire/Alamofire.git', :branch => 'dev'
pod 'Alamofire', :git => 'https://github.com/Alamofire/Alamofire.git', :tag => '3.1.1'
pod 'Alamofire', :git => 'https://github.com/Alamofire/Alamofire.git', :commit => '0f506b1c45'
```

---

#### Describe which types of dependencies above are supported and which will be implemented in future:

Cocoapods supports dependencies from git source and local path.

## Versioning

#### What versioning scheme do the package files use?

Package file use semver 2.0. ([details](https://semver.org))

---

#### Does this versioning scheme support range constraints, e.g. `^1.0.0` or `1.x`?

Versioning scheme supports logical operators:

- `> 0.1` Any version higher than 0.1
- `>= 0.1` Version 0.1 and any higher version
- `< 0.1` Any version lower than 0.1
- `<= 0.1` Version 0.1 and any lower version

In addition to the logic operators CocoaPods has an optimistic operator `~>`:

- `~> 0.1.2` Version 0.1.2 and the versions up to 0.2, not including 0.2 and higher
- `~> 0.1` Version 0.1 and the versions up to 1.0, not including 1.0 and higher
- `~> 0` Version 0 and higher, this is basically the same as not having it.

---

#### Is this package manager used for applications, libraries, or both? If both, is there a way to tell which is which?

Package manager used for applications only

---

#### If ranges are supported, are there any cases when Renovate should pin ranges to exact versions if rangeStrategy=auto?

I don't see such reason.

## Lookup

#### Is a new datasource required? Provide details

There is a index service for cocoapods. Developers always search for pod on this [site](https://github.com/CocoaPods):

Also, all podspec are stored in one [repo](https://github.com/CocoaPods/Specs)

---

#### Will users need the capability to specify a custom host/registry to look up? Can it be found within the package files, or within other files inside the repository, or would it require Renovate configuration?

User can specify a different location of the source. The official CocoaPods source is implicit. More details here

```
source 'https://github.com/artsy/Specs.git'
source 'https://github.com/CocoaPods/Specs.git'
```

---

#### Do the package files contain any "constraints" on the parent language (e.g. supports only v3.x of Python) or platform (Linux, Windows, etc) that should be used in the lookup procedure?

Cocoapods supports only mac platform.

---

#### Will users need the ability to configure language or other constraints using Renovate config?

I would add an option to check dependencies with only specific swift version.

## Artifacts

#### Are lock files or checksum files used? Mandatory?

Yes, lock file will be named `Podfile.lock`.

---

#### If so, what tool and exact commands should be used if updating 1 or more package versions in a dependency file?

To update single package: `pod update SomePodName`

To update all packages: `pod update`

---

#### If applicable, describe how the tool maintains a cache and if it can be controlled via CLI or env? Do you recommend the cache be kept or disabled/ignored?

Cocoapods keeps cache in directory `${HOME}/Library/Caches/CocoaPods`

You can get information about cache state and clean cache throutgh cocoapods ([details](https://guides.cocoapods.org/terminal/commands.html#group_cache))

---

#### If applicable, what command should be used to generate a lock file from scratch if you already have a package file? This will be used for "lock file maintenance".

You can generate `Podfile.lock` by running `pod install`. This command also install required dependencies and link them to xcode project.

I don't know hot to generate only `Podfile.lock`

## Other

#### Is there anything else to know about this package manager?

Cocoapods has interesting feature that may be usefull for renovate.
Command `pod outdated` lists all outdated dependecies ([details](https://guides.cocoapods.org/using/pod-install-vs-update.html#pod-outdated))

---

In order to add dependencies to your xcode project you have to create file named `Podfile`
in your Xcode project directory

```
platform :ios, '8.0'
use_frameworks!

target 'MyApp' do
  pod 'AFNetworking', '~> 2.6'
  pod 'ORStackView', '~> 3.0'
  pod 'SwiftyJSON', '~> 2.3'
end
```

After that you can install dependencies in your project by runing `pod install`

Also pod CLI supports creating own pod `pod spec create Peanut`

This command will create a podspec file. This file describes a version of Pod library. It includes details about where the source should be fetched from, what files to use, the build settings to apply, and other general metadata such as its name, version, and description. More details about podspec syntax you can find [here](https://guides.cocoapods.org/syntax/podspec.html)

```
Pod::Spec.new do |spec|
  spec.name         = 'Reachability'
  spec.version      = '3.1.0'
  spec.license      = { :type => 'BSD' }
  spec.homepage     = 'https://github.com/tonymillion/Reachability'
  spec.authors      = { 'Tony Million' => 'tonymillion@gmail.com' }
  spec.summary      = 'ARC and GCD Compatible Reachability Class for iOS and OS X.'
  spec.source       = { :git => 'https://github.com/tonymillion/Reachability.git', :tag => 'v3.1.0' }
  spec.source_files = 'Reachability.{h,m}'
  spec.framework    = 'SystemConfiguration'
  spec.dependency 'SomeOtherPod'
end
```

When you're done you can get an account and push your pod to the CocoaPods Trunk. CocoaPods Trunk is an authentication and CocoaPods API service. To publish new or updated libraries to CocoaPods for public release you will need to be registered with Trunk and have a valid Trunk session on your current device. More details about CocoaPods Trunk you can find [here](https://guides.cocoapods.org/making/getting-setup-with-trunk.html)

It's possible to perform `pod install` and `pod update` action in Docker-based version of cocoapods.
I used this (image)[https://github.com/MaSpeng/docker-hub-cocoapods] and random iOS project.
