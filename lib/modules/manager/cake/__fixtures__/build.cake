foo
#addin nuget:?package=Foo.Foo
#addin "nuget:?package=Bim.Bim&version=6.6.6"
#tool nuget:https://example.com?package=Bar.Bar&version=2.2.2
#tool nuget:https://example.com/feed/v3/?package=Cake.Git&version=2.2.3
#tool nuget:https://example.com/feed/v3/index.json?package=Cake.MinVer&version=2.2.4
#module nuget:file:///tmp/?package=Baz.Baz&version=3.3.3
#load nuget:?package=Cake.7zip&version=1.0.3
#l nuget:?package=Cake.asciidoctorj&version=1.0.0
// #module nuget:?package=Qux.Qux&version=4.4.4
/*
#module nuget:?package=Quux.Quux&version=5.5.5
*/
bar
#module nuget:foobar!@#
