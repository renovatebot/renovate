# Uses sidebar_label from YAML frontmatter as the nav/sidebar title,
# while keeping the full title for the HTML <title> element (via page.meta.title).
#
# Because on_page_context fires per-page before each template render, we must
# fix ALL page titles on the first call so the sidebar is consistent across
# every rendered page.

_titles_fixed = False


def on_page_context(context, page, config, nav, **kwargs):
    global _titles_fixed
    if not _titles_fixed:
        _titles_fixed = True
        _fix_all_titles(nav)
    return context


def _fix_all_titles(items):
    for item in items:
        if hasattr(item, 'children') and item.children:
            _fix_all_titles(item.children)
        if hasattr(item, 'meta') and 'sidebar_label' in getattr(item, 'meta', {}):
            item.title = item.meta['sidebar_label']
