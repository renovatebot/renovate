
## 4.33.0 [05-15-2020]

* add new auth, fix accept header and base path in mock

Closes ADAPT-207

See merge request itentialopensource/adapter-utils!177

---

## 4.32.3 [04-30-2020]

* set username and password in token entitypath

Closes ADAPT-198

See merge request itentialopensource/adapter-utils!176

---

## 4.32.2 [04-23-2020]

* fix issue with boolean properties

See merge request itentialopensource/adapter-utils!175

---

## 4.32.1 [04-23-2020]

* add ability to turn off encoding path vars

Closes ADAPT-188

See merge request itentialopensource/adapter-utils!174

---

## 4.32.0 [04-22-2020]

* add ability to return request header

Closes ADAPT-186

See merge request itentialopensource/adapter-utils!173

---

## 4.31.2 [04-09-2020]

* fix some logging to provide more details on -1 and formdata

Closes ADAPT-175

See merge request itentialopensource/adapter-utils!172

---

## 4.31.1 [03-26-2020]

* update actionSchema to allow & in the entitypath

Closes ADAPT-153

See merge request itentialopensource/adapter-utils!171

---

## 4.31.0 [03-25-2020]

* Resolve ADAPT-150 "Minor/"

Closes ADAPT-150

See merge request itentialopensource/adapter-utils!170

---

## 4.30.14 [03-17-2020]

* add in double check for starting slashes in the path

Closes ADAPT-136

See merge request itentialopensource/adapter-utils!169

---

## 4.30.13 [03-17-2020]

* updates for how global properties are handled - in particular when the payload is an array

Closes ADAPT-135

See merge request itentialopensource/adapter-utils!168

---

## 4.30.12 [03-06-2020]

* support for multiple schema types

Closes ADAPT-130

See merge request itentialopensource/adapter-utils!167

---

## 4.30.11 [03-05-2020]

* change to property schema for limit retry error

Closes ADAPT-129

See merge request itentialopensource/adapter-utils!166

---

## 4.30.10 [03-05-2020]

* add fix for sending empty and also for :var

Closes ADAPT-126

See merge request itentialopensource/adapter-utils!165

---

## 4.30.9 [02-20-2020]

* Modified xml to json parser.

Closes ADAPT-63

See merge request itentialopensource/adapter-utils!164

---

## 4.30.8 [02-14-2020]

* removing the XML due to issues with the dependencies - will find a way to add back shortly

See merge request itentialopensource/adapter-utils!163

---

## 4.30.7 [02-13-2020]

* add in a response that can be parsed

Closes ADAPT-89

See merge request itentialopensource/adapter-utils!162

---

## 4.30.6 [02-10-2020]

* fix for xml data getting lost

Closes ADAPT-85

See merge request itentialopensource/adapter-utils!161

---

## 4.30.5 [02-07-2020]

* update to handle cookie array and dot fields better

Closes ADAPT-81

See merge request itentialopensource/adapter-utils!160

---

## 4.30.4 [02-06-2020]

* update the priority handling

Closes ADAPT-76

See merge request itentialopensource/adapter-utils!159

---

## 4.30.3 [01-30-2020]

* fixes to throttle

Closes ADAPT-61

See merge request itentialopensource/adapter-utils!158

---

## 4.30.2 [01-29-2020]

* fix for decode b64

Closes ADAPT-56

See merge request itentialopensource/adapter-utils!157

---

## 4.30.1 [01-27-2020]

* update logs and change storage so it can store in adapter or at a full path provided

Closes ADAPT-41

See merge request itentialopensource/adapter-utils!156

---

## 4.30.0 [01-27-2020]

* add in priority queueing and ability to pass back an event

Closes ADAPT-20

See merge request itentialopensource/adapter-utils!155

---

## 4.29.0 [01-21-2020]

* add limit retry array to support multiple limit retry codes including ranges

Closes ADAPT-13

See merge request itentialopensource/adapter-utils!154

---

## 4.28.4 [01-21-2020]

* Resolve ADAPT-18 "Patch/"

Closes ADAPT-18

See merge request itentialopensource/adapter-utils!153

---

## 4.28.3 [01-20-2020]

* Revert "Merge branch 'patch/PH-50716' into 'master'"

See merge request itentialopensource/adapter-utils!152

---

## 4.28.2 [01-17-2020]

* PH-50716: Added handling of translate schema attribute.

Closes PH-50716

See merge request itentialopensource/adapter-utils!148

---

## 4.28.1 [01-08-2020]

* fix for xml parsed objects

See merge request itentialopensource/adapter-utils!151

---

## 4.28.0 [01-08-2020]

* Minor/xml parser

See merge request itentialopensource/adapter-utils!150

---

## 4.27.4 [01-07-2020]

* fix for the mock path return data

See merge request itentialopensource/adapter-utils!149

---

## 4.27.3 [12-30-2019]

* phase 1 for throttle with no database and db utils working with ssl

See merge request itentialopensource/adapter-utils!147

---

## 4.27.2 [12-20-2019]

* return cookie

See merge request itentialopensource/adapter-utils!146

---

## 4.27.1 [12-20-2019]

* fix redirect without full path and add a cookie if there is a set-cookie

See merge request itentialopensource/adapter-utils!145

---

## 4.27.0 [12-19-2019]

* Resolve PH-50162 "Minor/"

Closes PH-50162

See merge request itentialopensource/adapter-utils!144

---

## 4.26.0 [11-26-2019]

* add checks in check action that check file existance and schema for each action

Closes PH-47456

See merge request itentialopensource/adapter-utils!143

---

## 4.25.0 [11-26-2019]

* add checks in check action that check file existance and schema for each action

Closes PH-47456

See merge request itentialopensource/adapter-utils!143

---

## 4.24.7 [11-26-2019]

* fix to healthcheck

See merge request itentialopensource/adapter-utils!142

---

## 4.24.6 [11-22-2019]

* fix to mockdata

See merge request itentialopensource/adapter-utils!141

---

## 4.24.5 [11-21-2019]

* fix for withpathv in mockdata

See merge request itentialopensource/adapter-utils!140

---

## 4.24.4 [11-12-2019]

* fix for return that is just an array of data (no objects)

See merge request itentialopensource/adapter-utils!139

---

## 4.24.3 [11-06-2019]

* mock file fixes

See merge request itentialopensource/adapter-utils!138

---

## 4.24.2 [11-05-2019]

* fix issue with return raw

See merge request itentialopensource/adapter-utils!137

---

## 4.24.1 [11-04-2019]

* fix for datatype in stub mode

See merge request itentialopensource/adapter-utils!136

---

## 4.24.0 [11-01-2019]

* Resolve PH-46289 "Minor/"

Closes PH-46289

See merge request itentialopensource/adapter-utils!135

---

## 4.23.2 [10-29-2019]

* change to actionSchema for sso defaults

See merge request itentialopensource/adapter-utils!134

---

## 4.23.1 [10-28-2019]

* updates to schema files

See merge request itentialopensource/adapter-utils!133

---

## 4.23.0 [10-24-2019]

* Resolve PH-45668 "Minor/"

Closes PH-45668

See merge request itentialopensource/adapter-utils!132

---

## 4.22.0 [10-09-2019]

* Resolve PH-43704 "Minor/"

Closes PH-43704

See merge request itentialopensource/adapter-utils!129

---

## 4.21.1 [10-09-2019]

* fix path issue on redirects

See merge request itentialopensource/adapter-utils!130

---

## 4.21.0 [10-02-2019]

* Resolve PH-33642 "Minor/"

Closes PH-33642

See merge request itentialopensource/adapter-utils!122

---

## 4.20.1 [09-24-2019]

* patch the query when the query object is empty and fields are required

See merge request itentialopensource/adapter-utils!126

---

## 4.20.0 [09-24-2019]

* statuses now added as they occur, and made a this.uri field in dbUtil to...

Closes PH-43470

See merge request itentialopensource/adapter-utils!124

---

## 4.19.0 [09-23-2019]

* allow for tokens to come from headers/cookies

Closes PH-43462

See merge request itentialopensource/adapter-utils!123

---

## 4.18.0 [09-19-2019]

* Resolve PH-42028 "Minor/"

Closes PH-42028

See merge request itentialopensource/adapter-utils!121

---

## 4.17.2 [09-09-2019]

* update regex for , and ()

See merge request itentialopensource/adapter-utils!119

---

## 4.17.1 [09-06-2019]

* add headers to action schema

See merge request itentialopensource/adapter-utils!118

---

## 4.17.0 [09-05-2019]

* Resolve PH-42316 "Minor/" - added request and response datatypes

Closes PH-42316

See merge request itentialopensource/adapter-utils!117

---

## 4.16.1 [09-05-2019]

* fix for different types of encryption

See merge request itentialopensource/adapter-utils!116

---

## 4.16.0 [09-04-2019]

* Resolved PH-42056 - added encoding and encrypting body fields

Closes PH-42056

See merge request itentialopensource/adapter-utils!115

---

## 4.15.0 [09-04-2019]

* Resolves PH-42254: add urlencode datatype (request only)

Closes PH-42254

See merge request itentialopensource/adapter-utils!114

---

## 4.14.3 [08-30-2019]

* fix for merge object

See merge request itentialopensource/adapter-utils!113

---

## 4.14.2 [08-29-2019]

* fix no token

See merge request itentialopensource/adapter-utils!112

---

## 4.14.1 [08-29-2019]

* fix for parse field

See merge request itentialopensource/adapter-utils!111

---

## 4.14.0 [08-29-2019]

* Resolves PH-41330 added first phase of metrics

Closes PH-41330

See merge request itentialopensource/adapter-utils!110

---

## 4.13.0 [08-29-2019]

* Resolves PH-41588 parsing of individual fields

Closes PH-41588

See merge request itentialopensource/adapter-utils!109

---

## 4.12.0 [08-28-2019]

* Resolves PH-36501 small changes for 204

Closes PH-36501

See merge request itentialopensource/adapter-utils!108

---

## 4.11.1 [08-28-2019]

* Resolves PH-41541 fixes some bugs found

Closes PH-41541

See merge request itentialopensource/adapter-utils!107

---

## 4.11.0 [08-28-2019]

* Resolves PH-40139: changes for redirects

Closes PH-40139

See merge request itentialopensource/adapter-utils!106

---

## 4.10.0 [08-27-2019]

* Resolves PH-41334: added the support for Global Request Data to be defined in properties

Closes PH-41334

See merge request itentialopensource/adapter-utils!105

---

## 4.9.4 [07-31-2019]

* Update actionSchema.json

See merge request itentialopensource/adapter-utils!104

---

## 4.9.3 [07-29-2019]

* add filter to response after field is found, based on respFilter in schema

See merge request itentialopensource/adapter-utils!103

---

## 4.9.2 [07-26-2019]

* fix for query path changes

See merge request itentialopensource/adapter-utils!102

---

## 4.9.1 [07-26-2019]

* patch for uriPath issue

See merge request itentialopensource/adapter-utils!101

---

## 4.9.0 [07-24-2019]

* Resolve PH-25577 "Minor/"

Closes PH-25577

See merge request itentialopensource/adapter-utils!100

---

## 4.8.4 [07-15-2019]

* try pinning async-lock to remove vulnerability

See merge request itentialopensource/adapter-utils!99

---

## 4.8.3 [07-11-2019]

* fix action schema validation and no type data in schema

See merge request itentialopensource/adapter-utils!98

---

## 4.8.2 [07-02-2019]

* mockdata fields with value false now included during translations

See merge request itentialopensource/adapter-utils!97

---

## 4.8.1 [07-01-2019]

* fixes so that xml or pain text do not break mockdata return

See merge request itentialopensource/adapter-utils!96

---

## 4.8.0 [06-30-2019]

* Resolves PH-34761 - Accept Call Properties which can override adapter properties

Closes PH-34761

See merge request itentialopensource/adapter-utils!95

---

## 4.7.0 [06-27-2019]

* Resolves - PH-34823 - Ability to have multiple mock data files based on data

Closes PH-34823

See merge request itentialopensource/adapter-utils!94

---

## 4.6.10 [06-21-2019]

* Patch/healthcheckerrorlog

See merge request itentialopensource/adapter-utils!93

---

## 4.6.9 [06-21-2019]

* resolve socks proxy repair

See merge request itentialopensource/adapter-utils!92

---

## 4.6.8 [06-21-2019]

* Resolves PH-34472 - changes to fix http to https proxy

Closes PH-34472

See merge request itentialopensource/adapter-utils!91

---

## 4.6.7 [06-04-2019]

* Resolves PH_33846: fix to missing content-length on token, fix to request timeout error

Closes PH-33846

See merge request itentialopensource/adapter-utils!90

---

## 4.6.6 [05-20-2019]

* Resolves PH-33337 - fix the default error code

Closes PH-33337

See merge request itentialopensource/adapter-utils!89

---

## 4.6.5 [05-13-2019]

* Update contribution guidelines when external contributers in mind.

See merge request itentialopensource/adapter-utils!77

---

## 4.6.4 [05-08-2019]

* Resolves PH-32961 - fixes for handling error responses

Closes PH-32961

See merge request itentialopensource/adapter-utils!88

---

## 4.6.3 [04-24-2019]

* Resolves PH-32428 - change handling of response in mockdata

Closes PH-32428

See merge request itentialopensource/adapter-utils!87

---

## 4.6.2 [04-23-2019]

* Resolves PH-32254 - fix entitypath check

Closes PH-32254

See merge request itentialopensource/adapter-utils!86

---

## 4.6.1 [04-22-2019]

* patch/schema changes to schema?

See merge request itentialopensource/adapter-utils!85

---

## 4.6.0 [04-22-2019]

* Resolve PH-32062 "Minor/" - Add ability for token on url or in body

Closes PH-32062

See merge request itentialopensource/adapter-utils!84

---

## 4.5.2 [04-17-2019]

* :memo: Removes Pronghorn readme reference

Closes #2

See merge request itentialopensource/adapter-utils!82

---

## 4.5.1 [04-16-2019]

* Patch/security - update for security vulnerability

See merge request itentialopensource/adapter-utils!81

---

## 4.5.0 [04-11-2019]

* Resolves PH-31341: changes for setting variables in auth field and for adding request data to stored tokens

Closes PH-31341

See merge request itentialopensource/adapter-utils!75

---

## 4.4.6 [04-08-2019]

* removeBundled

See merge request itentialopensource/adapter-utils!74

---

## 4.4.5 [04-08-2019]

* patch/updatelicense

See merge request itentialopensource/adapter-utils!73

---

## 4.4.4 [04-08-2019]

* patch/FixLicense

See merge request itentialopensource/adapter-utils!72

---

## 4.4.3 [04-08-2019]

* Update package.json

See merge request itentialopensource/adapter-utils!71

---

## 4.4.2 [04-08-2019]

* Update package.json

See merge request itentialopensource/adapter-utils!70

---

## 4.4.1 [04-08-2019]

* change publish for opensource

See merge request itentialopensource/adapter-utils!69

---

## 4.4.0 [04-08-2019]

* Resolved minor/PH-31206: make adapter-utils opensource

Closes PH-31206

See merge request itentialopensource/adapter-utils!68

---

## [09-06-2018]

### Improvement

* Changes to add functionality, and allow multiple path variables, to the URI path as well as make it simpler.  [PH-16970](http://itential.atlassian.net/browse/PH-16970)

# Current Version: 4.3.1 [03-26-2019]

## New Features

* __3.10.0 [12-05-2018]__ - New methods have been add to:

support failover - there is a method (setFailover) that can be called by adapters to get the proper failover code.

support verifying capabilities - there is a method (verifyCapability) which will verify that the adapter supports the entity, action and specific entities (Array).

support caching entities - the verifyCapability used a cache of entities. This cache can be 'local' memory or in 'redis' based on the cache_location property. You can add entity lists into the cache using the addEntityCache method.

 [PH-21980](http://itential.atlassian.net/browse/PH-21980)

* __3.9.0 [12-04-2018]__ - The external name on schemas can now be at the same level or lower --

It can still be sys_id or it can be something like ticket.sys_id this allows translation to be done at different levels. [PH-20788](http://itential.atlassian.net/browse/PH-20788)

* __3.6.0 [11-16-2018]__ - The process to check the action files for validity has been moved into adapter-utils to reduce the code in the adapter-template. This also moves the actionSchema.json into the adapter-utils. [PH-20797](http://itential.atlassian.net/browse/PH-20797)
* __3.5.0 [11-16-2018]__ - Removed the requirement for the properties -authentication.token_URI_path, healthcheck.URI_path and healthcheck.protocol. These can now be taken care of in the .system entity. [PH-20778](http://itential.atlassian.net/browse/PH-20778)
* __2.1.0 [08-17-2018]__ - These libraries now support token re-use and expiration during the calls to the external system. [PH-14296](http://itential.atlassian.net/browse/PH-14296)
* __2.0.0 [08-13-2018]__ - The following issues are in this Sprint Branch

PH-16044 -- Add Generic call that is protocol and method independent

PH-16024 -- Mock data should not have to include the internal response information

PH-16125 -- Add Proxy capability to the connection

PH-15075 -- Support Base64 encoding on authentication

PH-14311 -- Adapter not returning errors on two phase calls (need to get token and then make call) and it is then running the second call.

PH-16053 -- Ability to encrypt/decrypt properties (passwords)

PH-16141 -- converted actions to an array and removed redundant data from response object

PH-16239 -- Change the path to read {} instead of <> when going through the entitypath

PH-16268 -- Change the type in the action.json response as single and multiple are confusing

PH-15718 -- Consistent returns that include status and code [PH-16131](http://itential.atlassian.net/browse/PH-16131)

## Improvements

* __4.2.1 [03-19-2019]__ - Updated calls to support MongoDB driver 3.1.7. [PH-28266](http://itential.atlassian.net/browse/PH-28266)
* __4.2.0 [02-25-2019]__ - Added getAllCapability call for IAP

Added refreshProperties so the adapter can take in new properties without having to restart it. [PH-24808](http://itential.atlassian.net/browse/PH-24808)

* __4.0.0 [02-08-2019]__ - Adapter-utils changed error and response objects to match the new standard. This is a breaking change so when using this with your adapter, make sure you handle these new objects. [PH-25372](http://itential.atlassian.net/browse/PH-25372)
* __3.13.2 [01-16-2019]__ - Added other REST Methods that were not available - OPTIONS, HEAD, TRACE, CONNECT. [PH-24158](http://itential.atlassian.net/browse/PH-24158)
* __3.12.0 [01-02-2019]__ - Added a base_path property and the ability to set {basePath} on the entitypath in the action files. [PH-23339](http://itential.atlassian.net/browse/PH-23339)
* __3.11.0 [01-02-2019]__ - Added the capability to have a timeout per action defined in the action.js. This timeout overrides the attempt_timeout property when it is provided. [PH-22466](http://itential.atlassian.net/browse/PH-22466)
* __3.7.0 [11-16-2018]__ - Adapter can now use expiration time returned on a token request for when the token expires. In addition, tokens can be stored in either local memory or redis. The later will survive an adapter restart. [PH-20803](http://itential.atlassian.net/browse/PH-20803)
* __3.4.0 [11-09-2018]__ - Adds an icode field to the error returns that will be used to determine if the request can be failed over to another adapter or not. [PH-20677](http://itential.atlassian.net/browse/PH-20677)
* __3.3.0 [10-12-2018]__ - Adapter-utils now supports defining the healthcheck and token in either the properties or in their own action files. [PH-18536](http://itential.atlassian.net/browse/PH-18536)
* __3.2.0 [09-26-2018]__ - Added support for version parameter on the entitypath for an action and a property so that the version only needs to be changed in a property. [PH-18530](http://itential.atlassian.net/browse/PH-18530)
* __3.1.0 [09-26-2018]__ - Added the ability to bypass translation on the returned data. [PH-17702](http://itential.atlassian.net/browse/PH-17702)

## Bug Fixes

* __4.3.1 [03-26-2019]__ - Fixed healthcheck headers [PH-29729](http://itential.atlassian.net/browse/PH-29729)
* __4.3.0 [03-22-2019]__ - Bug fixes and performance improvements [PH-29177](http://itential.atlassian.net/browse/PH-29177)
* __4.2.3 [03-20-2019]__ - Bug fixes and performance improvements
* __4.2.2 [03-19-2019]__ - Bug fixes and performance improvements
* __4.1.1 [02-21-2019]__ - Bug fixes and performance improvements
* __4.1.0 [02-21-2019]__ - Bug fixes and performance improvements
* __3.13.5 [02-08-2019]__ - Bug fixes and performance improvements
* __3.13.4 [01-31-2019]__ - Bug fixes and performance improvements
* __3.13.3 [01-31-2019]__ - Added the ability to say whether you want the adapter to send an empty body with the request or not (default). [PH-24874](http://itential.atlassian.net/browse/PH-24874)
* __3.13.1 [01-10-2019]__ - Bug fixes and performance improvements
* __3.13.0 [01-10-2019]__ - Bug fixes and performance improvements
* __3.12.2 [01-03-2019]__ - Bug fixes and performance improvements
* __3.12.1 [01-02-2019]__ - Bug fixes and performance improvements
* __3.11.1 [01-02-2019]__ - Added the ability to set ecdhCurve to auto through a property. [PH-23297](http://itential.atlassian.net/browse/PH-23297)
* __3.7.1 [11-27-2018]__ - Fixed encoding of the path variables. [PH-21440](http://itential.atlassian.net/browse/PH-21440)
* __3.2.1 [10-03-2018]__ - Healthcheck has been fixed so that errors are returned. [PH-18662](http://itential.atlassian.net/browse/PH-18662)
* __2.1.1 [08-23-2018]__ - Update package.json to point to correct gitlab location. [PH-16937](http://itential.atlassian.net/browse/PH-16937)

## Deprecation

## Security

---

# Previous Version: 1.3.2 [08-03-2018]

## New Features

* 1.2.0 [07-03-2018] Added the ability to define separate request and response schemas for an action. Three potential fields on each action in the action.json:
  * schema - this remains the best way to define a single schema for the action
  * requestSchema - this supersedes schema for requests going to the external sytem
  * responseSchema - this supersedes schema for requests coming from the external system. [PH-12811](http://itential.atlassian.net/browse/PH-12811)
* 1.1.0 [06-25-2018] Added the ability for the data translator utility to handle objects with dynamic fields. [PH-12808](http://itential.atlassian.net/browse/PH-12808)
* 1.0.19 [06-08-2018] Update CHANGELOG to reflect new format [PH-11323](http://itential.atlassian.net/browse/PH-11323)

## Improvements

* __1.3.1 [07-30-2018]__ - Added unit test setup. [PH-11880](http://itential.atlassian.net/browse/PH-11880)
* 1.3.0 [07-10-2018] Changes how the mock data files are defined to remove redundancy in the action.json. They are now defined on the responseObject in the mockFile field and the mockFiles Array is gone. [PH-13483](http://itential.atlassian.net/browse/PH-13483)

## Bug Fixes

## Security

* __1.3.2 [08-03-2018]__ - Removed jshint from dependencies. [PH-13789](http://itential.atlassian.net/browse/PH-13789)

---
