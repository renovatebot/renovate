# Reads the edit_url from the YAML page header and replaces the default one with it.

def on_page_context(context, page, config, **kwargs):
    if 'edit_url' in page.meta:
        page.edit_url = page.meta['edit_url']
    return context
