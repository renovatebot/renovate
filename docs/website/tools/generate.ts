import { setUncaughtExceptionCaptureCallback } from 'process';
import shell from 'shelljs';

shell.echo('generating docs');
shell.echo('===============');

shell.echo('copy assets');
shell.cp('-r', '../usage/assets', 'static/');

shell.echo('copy usage docs');
shell.cp('-r', '../usage/**/*.md', 'docs/');
