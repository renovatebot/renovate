requires 'perl', '5.008001';

requires 'Cookie::Baker', '0.07';
requires 'Devel::StackTrace', '1.23';
requires 'Devel::StackTrace::AsHTML', '0.11';
requires 'File::ShareDir', '1.00';
requires 'Filesys::Notify::Simple';
requires 'HTTP::Message', '5.814';
requires 'HTTP::Headers::Fast', '0.18';
requires 'Hash::MultiValue', '0.05';
requires 'Pod::Usage', '1.36';
requires 'Stream::Buffered', '0.02';
requires 'Test::TCP', '2.15';
requires 'Try::Tiny';
requires 'URI', '1.59';
requires 'parent';
requires 'Apache::LogFormat::Compiler', '0.33';
requires 'HTTP::Tiny', 0.034;
requires 'HTTP::Entity::Parser', 0.25;
requires 'WWW::Form::UrlEncoded', 0.23;

on test => sub {
    requires 'Test::More', '0.88';
    requires 'Test::Requires';
    suggests 'Test::MockTime::HiRes', '0.06';
    suggests 'Authen::Simple::Passwd';
    suggests 'MIME::Types';
    suggests 'CGI::Emulate::PSGI';
    suggests 'CGI::Compile';
    suggests 'IO::Handle::Util';
    suggests 'LWP::Protocol::http10';
    suggests 'HTTP::Server::Simple::PSGI';
    suggests 'HTTP::Request::AsCGI';
    suggests 'LWP::UserAgent', '5.814';
    suggests 'HTTP::Headers';
    suggests 'Log::Dispatch::Array';
};

on runtime => sub {
    suggests 'FCGI';
    suggests 'FCGI::ProcManager';
    suggests 'CGI::Emulate::PSGI';
    suggests 'CGI::Compile';
    suggests 'LWP::UserAgent', '5.814';
    suggests 'Log::Log4perl';
    suggests 'Log::Dispatch', '2.25';
    suggests 'Module::Refresh';
};
