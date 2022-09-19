# This Makefile is used to do i18n relevant chores.
# There are 2 targets(jobs definition) that prefixed with 'i18n' here:
#
# 1. i18n/sources.tx
#    When you run `make i18n/sources.tx` at your terminal,
#    the `grep` program will search Gettext related calling recursively under `lib` directory,
#    then sorts these matched file names and puts them to i18n/sources.txt,
#    i18n/sources.txt is required for the `xgettext` program.
#
# 2. i18n/messages.pot
#
#    This target extracts translatable strings from given input files(i18n/sources.txt for our case),
#    please learn more details from https://www.gnu.org/software/gettext/manual/html_node/xgettext-Invocation.html

# How to use them? First, run target `i18n/sources.txt`:
#
# ```sh
# make i18n/sources.txt
# ```
#
# then run targte `i18n/messages.pot`:
#
# ```sh
# make i18n/messsage.pot
# ```
#
# after that you should see `i18n/messages.pot` have been modified (Even have no `msgid` changed, the POT file's timestamp should be updated whatever.)

# By default, Makefile targets are "file targets" - they are used to build files (executable object files) from other files.
# However, sometimes you want your Makefile to run commands that do not represent physical files in the file system.
# For example, extract translatable string over and over. These special target are called "phony", and we explicitly declar with
# `.PHONY` target.
.PHONY: i18n/sources.txt i18n/messages.pot

i18n/sources.txt:
	@grep \
		--files-with-match \
		--recursive \
		--include \*.ts \
		--extended-regexp "\.(gettext|dgettext|ngettext|dngettext|pgettext|dpgettext|npgettext|dnpgettext)\(" lib | sort > i18n/sources.txt

i18n/messages.pot:
	@xgettext \
		--files-from=i18n/sources.txt \
		--output=i18n/messages.pot \
		--sort-by-file \
		--join-existing \
		--language=JavaScript \
		--package-name=renovate-platform
