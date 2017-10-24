Package.describe({
	'name': 'steffo:meteor-accounts-saml',
	'summary': 'SAML Login (SP) for Meteor. Works with OpenAM, OpenIDP and provides Single Logout.',
	'version': '0.0.1',
	'git': 'https://github.com/steffow/meteor-accounts-saml.git'
});

Package.on_use(function(api) {
	api.use('rocketchat:lib', 'server');
	api.use('ecmascript');
	api.use(['routepolicy', 'webapp', 'underscore', 'service-configuration'], 'server');
	api.use(['http', 'accounts-base'], ['client', 'server']);

	api.add_files(['saml_server.js', 'saml_utils.js'], 'server');
	api.add_files(['saml_rocketchat.js'], 'server');
	api.add_files('saml_client.js', 'client');
});

Npm.depends({
	'xml2js': '0.2.0',
	'xml-crypto': '0.6.0',
	'xmldom': '0.1.19',
	'connect': '2.7.10',
	'xmlbuilder': '2.6.4',
	'querystring': '0.2.0'
});
