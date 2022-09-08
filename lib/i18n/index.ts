import i18n from 'gettext.js';

import githubZhCN from '../../locales/zh-CN/github.json';
import githubJa from '../../locales/ja/github.json';

export const gettext = i18n();

gettext.setMessages('github', 'zh-CN', githubZhCN, 'nplurals=2; plural=n>1;');
gettext.setMessages('github', 'ja', githubJa, 'nplurals=2; plural=n>1;');
