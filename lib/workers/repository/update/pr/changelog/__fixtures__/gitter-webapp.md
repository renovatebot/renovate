# 20.27.0 - *upcoming*

- Update chat-service.js; operation string parameter in error reporter updated, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1890>
  - Thanks to [@zzxoto](https://gitlab.com/zzxoto) for the contribution

# 20.26.1 - 2020-05-21

- Optimizing MongoDB query for chat archive, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1887>

# 20.26.0 - 2020-05-18

- Removing markup from a part of the French translation, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1878>
- Fix typo documentation -> documentation, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1880>
  - Thanks to [@auua](https://gitlab.com/auua) for the contribution
- Fix `/channel` slash command name regex to accept hyphenated names, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1881>
  - Thanks to [@auua](https://gitlab.com/auua) for the contribution
- Add GitLab branding to the left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1865>
- Fix left-menu search state showing all rooms, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1883>
- Update Polish translation, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1882>
  - Thanks to [@biesiad](https://gitlab.com/biesiad) for the contribution

# 20.25.0 - 2020-05-12

- Fix collaborators view by listening on room id change, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1866>
- Update notification docs with short snippet on altering desktop notification settings and sound, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1868>
  - Thanks to [@jeffcsauer](https://gitlab.com/jeffcsauer) for the contribution
- Add thread support to Sidecar (embedded renderer), <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1860>
- Update French translations, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1876>
  - Thanks to [@yaningo](https://gitlab.com/yaningo) for the contribution
- Fix being able to create community for your own GitHub username, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1870>
- Fix stuck unread badge, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1871>

Developer facing:

- Add docs for how to solve the missing `cld` dependency problem, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1863>
- Remove unused `DeletePit` code, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1873>
- Update delete unread script to output unreads to be deleted and prompt for confirm deletion, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1872>

# 20.24.0 - 2020-05-06

- Add accessible labels to the left-menu menu bar buttons, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1837>
- Add documentation details on needing to be signed in with GitLab to create GitLab based community/room, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1851>
- Update Gitter support room links in docs after rename, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1855>
- Add accessible list attributes to chat message items for easier navigation, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1856>
- In App announcements, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1850>
- Styling announcements for dark theme, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1867>

Developer facing:

- Set default tags in CI config, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1847>
- Absorb `@gitterhq/translations` npm module (including history), <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1846>
- Fix assertions in OAuth clients test, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1849>
- Add utility script to delete stuck mention, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1840>
- Small left menu improvements, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1853>
- Add stats for when someone opens the read by popover, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1854>
- Revert back to Debian/Ubuntu based image so Cypress e2e test dependencies are available, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1859>
- Fix e2e create room tests, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1861>

# 20.23.0 - 2020-04-22 - Threaded conversations

- Add support for passing the initial room name, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1839>
- Add accessible labels to any backbone/marionette code that uses the Tooltip behavior, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1836>
- Remove threaded-conversations room-based toggle, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1830>
- Update room creation docs with screenshots for new flow, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1841>
- Prepare documentation for full release of Threaded messages, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1832>
- Adding a name to notable releases, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1842>
- Add stats for opening the create community/room flows, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1843>
- Add download link to latest unsigned desktop macOS version, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1844>
  - Thanks to [@Nezteb](https://gitlab.com/Nezteb) for the contribution

# 20.22.1 - 2020-04-27

- Security fix related to Google analytics, <https://gitlab.com/gitlab-org/gitter/webapp/-/issues/2487>
  - <https://dev.gitlab.org/gitlab/gitter/webapp/-/merge_requests/56>
- Security fix related to GitHub only rooms, <https://gitlab.com/gitlab-org/gitter/webapp/-/issues/2328>
  - <https://dev.gitlab.org/gitlab/gitter/webapp/-/merge_requests/55>

# 20.22.0 - 2020-04-17 - GitLab based rooms

- Add French homepage translations, <https://gitlab.com/gitlab-org/gitter/gitter-translations/-/merge_requests/83>
  - Thanks to [@yaningo](https://gitlab.com/yaningo) for the contribution
  - <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1829>
- Update OAuth scope docs to better show how we have things are configured minimally and link from login page, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1826>
- Add relevant issue links to our account merging docs, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1833>
- Add Vue.js create room flow with GitLab project based room support, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1818>
- Remove old create room flow, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1831>

Developer facing:

- Removing manual beta and staging deployment steps, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1828>

# 20.21.0 - 2020-04-14

- Add details on why we use certain Twitter OAuth permissions, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1820>
- Fix API issue state endpoint returning 500 errors, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1824>

Developer facing:

- Reintroduce skipping local development OAuth setup, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1825>

# 20.20.0 - 2020-04-03

- Make GitHub OAuth juggling docs easier to follow, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1805>
- Add avatar support for GitLab project based communities, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1801>
- Add GitLab project based community/room support to the permissions view, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1806>

Developer facing:

- Fix configure secrets readme reference, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1815>
- Update docker image and fix `container_scanning` GitLab CI job, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1788>
  - Fix `docker-base` and `containerize` CI jobs (get them passing again)
  - Thanks to [@dcouture](https://gitlab.com/dcouture) for the contribution
- Add user repo API tests for GitLab projects (also fix user repo endpoint to not fetch all public GitLab.com projects), <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1809>

# 20.19.1 - 2020-04-02

- Revert: Running webapp locally doesn't require setting up secrets, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1795>

# 20.19.0 - 2020-03-12

- Change footer to link to <https://about.gitlab.com>, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1784>
  - Thanks to [@shanerice](https://gitlab.com/shanerice) for the contribution
- Clarify how/why we use certain GitLab OAuth scopes, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1804>
- Create community frontend for GitLab projects, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1800>
- Add header link support for GitLab project based rooms, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1803>
- Add GL_PROJECT support to header view who can join tooltip, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1802>
- Better clarify announcements notification setting, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1813>
  - Thanks to [@ianfixes](https://gitlab.com/ianfixes) for the contribution

Developer facing:

- Small lerna link fix, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1773>
  - Thanks to [@a2902793](https://gitlab.com/a2902793) for the contribution
- ~~Update docker image and fix `container_scanning` GitLab CI job,~~ <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1787>
  - -> Rollback docker image to fix CI, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1810>
  - Thanks to [@dcouture](https://gitlab.com/dcouture) for the contribution
- Add GitLab project service, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1781>
- Add `gl-project-policy-delegate`, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1786>
- Add admin discovery for GitLab projects, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1789>
- Add pre-creation `GL_PROJECT` delegate to policy-factory, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1791>
- Add GitLab projects to repos endpoint, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1790>
- Add `GL_PROJECT` group sd transform to normal group, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1794>
- Running webapp locally doesn't require setting up secrets, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1795>
- Deploying to beta from the xenial branch, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1798>
- Add `gitlab-room` stats for room creation, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1797>
- Add `GL_PROJECT` admins to admin-filter, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1796>
- Add `GL_PROJECT` to `security-descriptor-generator`, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1792>
- Add `GL_PROJECT` to `security-descriptor-validator`, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1793>
- Add `GL_PROJECT` as a possible type for group creation docs, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1807>
- Add test for creating `GL_PROJECT` based group, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1799>
- Add `GL_PROJECT` to the linkPath validation for room creation, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1808>

# 20.18.0 - 2020-02-20

- Fix translation logic to properly credit translator, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1768>
  - Thanks to [@a2902793](https://gitlab.com/a2902793) for the contribution
- Hide parent message indicator on native mobile, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1778>
- Update Gitter translation strings with the latest from the webapp, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1779>
  - Thanks to [@a2902793](https://gitlab.com/a2902793) for the contribution
- Remove mention of mobile apps and update apps image, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1776>
- Fix left-menu expanding while scrolling chats, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1766>
- Fix URL parse problem with strange mailto link(`'@test'`) (update `gitter-markdown-processor`), <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1774>
- Specify background color for body of notification emails, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1782>
  - Thanks to [@luciash](https://gitlab.com/luciash) for the contribution

Developer facing:

- Detail of webapp production setup, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1775>
- Fix test skipping when integration fixtures are missing, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1780>

# 20.17.0 - 2020-02-17 - GitLab based communities

- Add finger swiping to left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1761>
- Fix "Double-tap to edit a message on mobile not working", <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1760>
- Add GitLab group(`GL_GROUP`) support to the permission settings view, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1763>
- Add GitLab group(`GL_GROUP`) support to header view who can join tooltip, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1751>
- Left-menu mobile styles now trigger based on device width instead of `user-agent`, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1762>
- Include child thread messages in main message feed on mobile, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1728>
- Update translations for proper Ukranian language code(`ua` -> `uk`), <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1772>
  - Thanks to [@a2902793](https://gitlab.com/a2902793) for the contribution
- Vue.js create community flow and GitLab group based communities, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1757>
- Make sure we only skip web middlewares on /api/ and not on /api* routes, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1771>

Developer facing:

- Clarify why `clientEnv['anonymous']` is used in `context.getAccessToken()`, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1764>
- Update link for Gitter spam runbook for abuse team, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1765>
- Ensure fixtures used in group with policy service test, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1769>

# 20.16.2 - 2020-02-13

- Fix caching on GitLab group/user services, <https://dev.gitlab.org/gitlab/gitter/webapp/-/merge_requests/53>

# 20.16.1 - 2020-02-07

- Security fix related to burst messages, <https://dev.gitlab.org/gitlab/gitter/webapp/-/merge_requests/51>

# 20.16.0 - 2020-01-29

- Improve URI conflict error messages when creating a community, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1735>
- Add `GL_GROUP` and inherited `GROUP` support for the chat header link, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1738>
- Permalink to parent message opens thread message feed at the bottom, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1741>
- Fix right-toolbar toggle hover flicker v2 -> simplify toggle button, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1747>
- Add "Join room" and "Sign in to start talking" buttons to thread message panel, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1742>
- Add "Open in GitLab" option to room settings dropdown, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1750>
- Fix object serialized for empty error message in tags modal(`[object Object]`), <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1754>
- Follow GitHub association from inherited group security descriptor for repo info section in the right-toolbar, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1753>
- Link to private repo access grant page("Allow Private Repo Access") in commit popover, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1752>
  - Thanks to [@redsandro](https://gitlab.com/redsandro) for the contribution
- Fix mobile bug where message was sent on chat-message input blur, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1758>

Developer facing:

- Add `GL_GROUP` support to the `scripts/utils/rename-group.js` utility script, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1734>
- Remove unused `roomService.createRoomByUri()`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1727>
- Add test for GitLab group creation, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1739>
- Add user orgs test for GitLab, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1740>
- Add notes about splitting from GitHub URI reservation to `userScopes.isGitHubUser()`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1743>
- Remove unused `chat-input` `updateDraftMessage()`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1744>
- Add `GL_GROUP` test case to the group API tests, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1745>
- Remove unused `getGitHubPath()`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1749>
- Refactor `group-with-policy-service` tests to `async`/`await`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1748>
- Always serialize providers for Troupe, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1755>

# 20.15.3 - 2020-01-27

Developer facing:

- Security fix related to image content, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2037>
  - Add Camo to proxy image assets, <https://user-content.gitter-static.net/>
  - Thanks to [@iframe](https://hackerone.com/iframe) for [responsibly disclosing](https://about.gitlab.com/security/disclosure/) this vulnerability to us.
  - <https://dev.gitlab.org/gitlab/gitter/webapp/-/merge_requests/39>

# 20.15.2 - 2020-01-23

Developer facing:

- Serialize current room before passing to Vue initial state frontend, <https://dev.gitlab.org/gitlab/gitter/webapp/-/merge_requests/48>

# 20.15.1 - 2020-01-20

Developer facing:

- Disallow `Transfer-Encoding: chunked` for any API request, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2292>
  - <https://dev.gitlab.org/gitlab/gitter/webapp/merge_requests/46>

# 20.15.0 - 2020-01-16

- Fix typo in failed to fetch thread error, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1730>
- Add left-menu mobile toggle to explore page (sign-in landing page), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1729>
- Open TMF on mobile, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1733>

Developer facing:

- Defer to root `package.json` for npm packages, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1724>
- Add docs on how to invalidate a GitHub and Gitter access tokens, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1725>
- Fix Mongo table scans when using `OAuthAccessToken.find({ clientId });`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1722>
- Move npm troubleshooting to developer FAQ, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1731>
- Renovate: Keep using semver for package versions, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1703>
- Update dependency `keyword-extractor` to `v0.0.18`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1504>
- Add process for testing renovate changes, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1736>

# 20.14.0 - 2020-01-10

- Add some docs on usage and enable threaded conversations, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1713>
- Prevent notification email replies to go to support@gitter.im, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1589>

Developer facing:

- Add `GL_GROUP` to `security-descriptor-validator`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1699>
- Add `GL_GROUP` support to `policy-delegate-factory`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1710>
- Add `GL_GROUP` to create room server input validation, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1717>
- Remove unused `permission-combinations.js`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1719>
- Add `glGroupService.isMaintainer` for `GL_GROUP_MAINTAINER` admins, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1712>
- Remove Bluebird promise usage for async/await `gl-group-policy-delegate.js` compatibility, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1714>
- Add `#integrationGitlabUser1` for easy GitLab integration testing, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1709>
- Add GitLab user service, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1707>
- Add `pre-creation/gl-group-policy-evaluator`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1708>
- Update groups API doc with `GL_GROUP` backing type, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1716>
- Add `gitlab-uri-validator`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1706>
- Remove orphaned "unused org" server code, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1715>
- Remove orphaned "unused repo" server code, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1720>
- Add `GL_GROUP_MAINTAINER` permissions to the `gl-group-policy-delegate`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1711>
- Add `GL_GROUP` support to `ensure-access-and-fetch-descriptor`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1702>
- Use `assert.rejects()` for standard promise rejection assertion, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1723>
- Add `GL_GROUP` to security-descriptor transform, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1721>

# 20.13.1 - 2020-01-10

- Serialize user before passing to Vue initial state frontend, <https://dev.gitlab.org/gitlab/gitter/webapp/merge_requests/44>

# 20.13.0 - 2020-01-03

- Fix "Last message gets covered by text input box", <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1695>
  - Thanks to [@basisbit](https://gitlab.com/basisbit) for the contribution
- Variable thread message feed width, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1696>
- Unify Vuex message API request logic, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1693>

Developer facing:

- Android push notification updates for gcm to fcm, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1690>
- Add `GL_GROUP` to admin filter, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1691>
- Add `GL_GROUP` group avatars (auto-update), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1692>
- Better document what `troupe.providers` is used for, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1698>
- Remove unused sd utils `isType()` method, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1701>
- Skip CSRF for API - local development, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1704>
- Add `GL_GROUP` to `security-descriptor-generator`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1700>

# 20.12.0 - 2019-12-17

Developer facing:

- Add `VuexApiRequest` `error` to the store, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1683>
- Add permissions `gl-group-policy-delegate`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1679>
- Avoid using `authenticate bearer` for the API, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1652>
- Add some debug tracing for the unread banner and scrolling to chats, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1688>
- Remove Vue test value, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1685>
- Add GitLab group admin discovery, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1681>
- Documentation: Miscellaneous tips and tricks for developers, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1687>

# 20.11.0 - 2019-12-10

- Restore social metadata to rooms/chats, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1665>
- Fix welcome message not showing when joining a room, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1671>
- Improve action popover implementation - hiding/showing + styles, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1669>
- Allow editing and deleting messages in Sidecar, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1674>
- Fix archive not showing messages in the current day, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1675>
- Remove community creation invite step, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1677>
- Include room permissions with the VueX seed data (fix delete message context menu), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1682>
- Edit thread message UI, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1676>
- Add Quote and Report actions to thread messages, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1686>

Developer facing:

- Add scripts to aggregate Gitter community data into reports (stats), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1668>
- Update message API endpoint cleanup, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1670>
- Add GitLab API backend for groups -> `/api/v1/user/:userId/orgs` endpoint, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1559>
- Use `ChatItemPolicy` to handle edit state, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1673>
- Add notes about splitting from GitHub URI reservation, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1680>
- Add stats for threaded conversations, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1689>

# 20.10.0 - 2019-11-27

- Fix stuck unread notification(unable to dismiss) for thread message in desktop app (add `IntersectionObserver` polyfill), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1664>
- Remove `/~card` route, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1660>

Developer facing:

- Fix wrong user signed in with e2e tests (Cypress cookie sharing), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1657>
- Fix flakiness in create room e2e test, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1656>
- Remove `cypress-failed-log` dependency to clean up Cypress devtools console and output, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1658>
- Fix iOS build script when isn't an existing webpack bundle built (`npm run build-ios-assets`), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1662>
  - Thanks to [@dtogias](https://gitlab.com/dtogias) for the contribution
- Remove `overrideUnreadTo` in chat serialization, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1661>
- Remove `scripts/utils/trim-one-to-one-rooms.js` in favor of `scripts/utils/clean-up-users-old-one-to-one.js`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1666>

# 20.9.1 - 2019-11-26

- Security fix related to avatar API, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2311>
  - <https://dev.gitlab.org/gitlab/gitter/webapp/merge_requests/42>

# 20.9.0 - 2019-11-20

- Fix "Thread message feed not showing when user isn't room member", <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1645>
- Add emoji support to thread messages, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1644>
- Remove router-nli-app and don't fingerprint anonymous users, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1650>
- Add "Delete" action for thread messages, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1634>
- Update homepage with some more pertinent feature details, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1655>
- Not logged in view on threaded conversations, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1653>

Developer facing:

- Update to `cypress@3.6.1`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1646>
- Fix unread badge click open thread e2e test, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1642>
- Make create room e2e test more robust, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1643>
- Rename ChatStrategy unread option, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1651>
- Add tests for anonymous access to API, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1654>

# 20.8.0 - 2019-11-11

- Just mark thread chat read if the feature toggle is off, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1633>
- Remove cyclic invocation from room navigation, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1625>
- Remove font preloading, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1637>
- Flex wrap the share buttons on Spread the word, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1638>
- Move favourite and community home header actions to room settings dropdown when mobile, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1614>
- Add left-menu toggle to the mobile chat header, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1639>

Developer facing:

- GitHub repo rooms can be renamed, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1623>
- Support both commonJS and ES modules during server side render, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1635>
  - Fix server crashes from @babel/runtime not being available to production bundle during Vue SSR render, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1649>
- Update to `cypress@3.6.0`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1640>
- Avoid Cypress warnings about mixing promise and cy commands, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1641>

# 20.7.0 - 2019-10-30

- Update @gitterhq/translations to 1.12.0, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1627>
  - Thanks to [@a2902793](https://gitlab.com/a2902793) for the contribution
- Fix right toolbar activity time color in dark theme, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1629>
  - Thanks to [@tameo](https://gitlab.com/tameo) for the contribution

Developer facing:

- Fix `cy.enableThreadedConversations(user, room)` in failing e2e tests, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1630>
- Update to `cypress@3.5.0`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1631>
- Run `npm audit fix` to update some dependencies, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1617>

# 20.6.0 - 2019-10-18

- Unread notifications for child messages, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1606>
- Add room-scoped feature toggle for threaded-conversations, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1620>
- Fix: Welcome message stopped showing, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1624>
- Fix "Google search results usually link to the wrong place", <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1608>
- Use room based threaded conversations toggle, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1622>

Developer facing:

- `eslint`: `no-param-reassign` rule, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1621>

# 20.5.0 - 2019-10-10

- Sending a message focuses thread message feed on it, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1604>
- Fix a condition that triggers update of group avatars, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1611>

Developer facing:

- Use more robust security CI includes which will work on [`dev.gitlab.org`](https://dev.gitlab.org/), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1607>
- Update docker-compose file to version 3, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1609>
- Remove bluebird usage from delete-user script, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1605>
- Fix iOS asset build, including embedded chat startup, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1610>
  - Thanks to [@puremourning](https://gitlab.com/puremourning) for the contribution
- Exclude non-production code from SAST scans, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1612>
- Generate DAST security reports in CI (for [GitLab security dashboard](https://gitlab.com/help/user/application_security/security_dashboard/index.md)), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1613>
- Introduce backbone eslint plugin, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1615>
- Update to `cypress@3.4.1`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1616>

# 20.4.4 - 2019-10-10

- Security fix related to OAuth client authorization flow, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2305>
  - Thanks to [@gregxsunday](https://hackerone.com/gregxsunday) for [responsibly disclosing](https://about.gitlab.com/security/disclosure/) this vulnerability to us.
  - <https://dev.gitlab.org/gitlab/gitter/webapp/merge_requests/40>

# 20.4.3 - 2019-10-2

- Fix Twitter share link in create room email, <https://dev.gitlab.org/gitlab/gitter/webapp/merge_requests/36>

# 20.4.2 - 2019-10-2

- Security fix related to email templates, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2086>
  - Thanks to [@paresh_parmar](https://hackerone.com/paresh_parmar) for [responsibly disclosing](https://about.gitlab.com/security/disclosure/) this vulnerability to us.
  - <https://dev.gitlab.org/gitlab/gitter/webapp/merge_requests/30>
- Security fix related to uploads, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2114>
  - Thanks to [@iframe](https://hackerone.com/iframe) for [responsibly disclosing](https://about.gitlab.com/security/disclosure/) this vulnerability to us.
  - <https://dev.gitlab.org/gitlab/gitter/webapp/merge_requests/34>

# 20.4.1 - 2019-9-26

- Security fix related to message text processing, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2083>
  - Thanks to [@jaykpatel](https://hackerone.com/jaykpatel) for [responsibly disclosing](https://about.gitlab.com/security/disclosure/) this vulnerability to us.
  - <https://dev.gitlab.org/gitlab/gitter/webapp/merge_requests/29>

# 20.4.0 - 2019-9-25

- Clarify how `@/all` can be used, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1594>
  - Thanks to [@isiahmeadows](https://gitlab.com/isiahmeadows) for the contribution
- Update epics roadmap links to use updated Gitter label( ~"Gitter" -> ~"group::gitter"), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1595>
- Dark theme style for TMF chat input text, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1598>
- Infinite scrolling of Thread message feed, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1592>
- Fix an invalid robots.txt API entry, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1601>
- Fix iOS mobile safari: scrolling to unexpected post when keyboard opened, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1600>

Developer facing:

- Script to add a user as an extra admin of a group, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1597>
- Clean up user-rooms-api-tests.js, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1599>
- Generate security reports in CI (for [GitLab security dashboard](https://gitlab.com/help/user/application_security/security_dashboard/index.md)), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1375>
- Have an option to send email notification with real room messages, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1602>

# 20.3.4 - 2019-9-25

- Security fix related to banning users, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2100>
  - Thanks to [@n0n4me](https://hackerone.com/n0n4me) for [responsibly disclosing](https://about.gitlab.com/security/disclosure/) this vulnerability to us.
  - <https://dev.gitlab.org/gitlab/gitter/webapp/merge_requests/28>
- Security fix related to OAuth flow, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2278>
  - <https://dev.gitlab.org/gitlab/gitter/webapp/merge_requests/26>

# 20.3.3 - 2019-9-18

- Security fix related to access to room information, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2082>
  - Thanks to [@dhakalananda](https://hackerone.com/dhakalananda) for [responsibly disclosing](https://about.gitlab.com/security/disclosure/) this vulnerability to us.
  - <https://dev.gitlab.org/gitlab/gitter/webapp/merge_requests/25>

# 20.3.2 - 2019-9-12

- Security fix related deleting OAuth clients and access tokens, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2053>
  - Thanks to [@favicon](https://hackerone.com/favicon) for [responsibly disclosing](https://about.gitlab.com/security/disclosure/) this vulnerability to us.
  - <https://dev.gitlab.org/gitlab/gitter/webapp/merge_requests/22>
  - <https://gitlab.com/gitlab-org/gitter/developer-gitter-im/merge_requests/26>

# 20.3.1 - 2019-9-12

- Fix "Gitter OAuth app flow is messed up", <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1596>

# 20.3.0 - 2019-09-11

- Show "Reply in thread" for parent messages, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1581>
- Fix community home overflowing, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1587>
- Fix mobile swipe to open left-menu gesture on userhome, explore, and community home, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1588>
- Update `@gitterhq/translations` to `1.11.0`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1586>
- Permalinks in thread message feed, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1582>
- Put the parent message indicator behind a feature toggle, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1591>

Developer facing:

- Move some apps content strings to be translatable, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1583>
- Document and make it easier to run the e2e tests, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1585>

# 20.2.0 - 2019-9-3

- Fix missing unreads in left-menu after sleeping/suspending computer, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1564>
- Add set of straightforward instructions to get OAuth scopes to match, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1580>

# 20.1.3 - 2019-9-3

- Security fix related deleted user tokens, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2081>
  - Thanks to [@dhakalananda](https://hackerone.com/dhakalananda) for [responsibly disclosing](https://about.gitlab.com/security/disclosure/) this vulnerability to us.
  - <https://dev.gitlab.org/gitlab/gitter/webapp/merge_requests/20>

# 20.1.2 - 2019-8-29

- Security fix related login session, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2051>
  - Thanks to [@favicon](https://hackerone.com/favicon) for [responsibly disclosing](https://about.gitlab.com/security/disclosure/) this vulnerability to us.
  - <https://dev.gitlab.org/gitlab/gitter/webapp/merge_requests/18>

# 20.1.1 - 2019-8-28

- Make left-menu room links available on page-load(SSR), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1573>
- Fix mobile homepage styles, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1579>

Developer facing:

- Only listen on chatCollection if we are in troupe context, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1577>

# 20.1.0 - 2019-8-27

- Showing the parent message indicator in the main message feed, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1563>
- Threaded Conversations: Indicate that the message hasn't been stored in DB, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1568>
- Improve left-menu create community/room plus(`+`) icon, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1569>
- Try to make connectivity indicator styles more performant, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1570>
- Add link to docs/help in profile menu dropdown, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1571>
- Update learn content and move to userhome(`/home`), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1572>

Developer facing:

- Remove `supertest-as-promised` dependency, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1560>
- Do not use partial index for child messages, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1567>
- Remove `vue-left-menu` feature toggle from Cypress e2e tests, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1574>
- Add API documentation for hiding a room, <https://gitlab.com/gitlab-org/gitter/docs/merge_requests/58>
  - Thanks to [@aj-vargas](https://gitlab.com/aj-vargas) for the contribution
- Update dependency `shutdown` to `^0.3.0`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1519>

# 20.0.1 - 2019-08-23

- Restore custom styling on left panel scrollbar, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1565>
  - Thanks to [@cbj4074](https://gitlab.com/cbj4074) for the contribution
- Security fix related to access token, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2056>
  - Thanks to [@amalyoman](https://hackerone.com/amalyoman) for [responsibly disclosing](https://about.gitlab.com/security/disclosure/) this vulnerability to us.
  - <https://dev.gitlab.org/gitlab/gitter/webapp/merge_requests/17>
- Security fix related to admin access, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2207>
  - Thanks to [@giddsec](https://hackerone.com/giddsec) for [responsibly disclosing](https://about.gitlab.com/security/disclosure/) this vulnerability to us.
  - <https://dev.gitlab.org/gitlab/gitter/webapp/merge_requests/16>

Developer facing:

- Fix `develop` branch failing with missing dependencies, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1566>

# 20.0.0 - 2019-8-14

- Loading child messages when opening the TMF, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1545>
- Remove old left-menu code, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1553>
- Fix favourite drag box highlight in dark theme, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1561>

Developer facing:

- Use `VuexApiRequest` for the left-menu search, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1557>
- Fix `delete-messages-from-user.js` utility script to remove messages instead of clearing them, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1555>
- Move Jest unit tests to production folders alongside code (`test/public-js` to `public/js`), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1554>
- Remove Mixpanel, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1541>

# 19.60.0 - 2019-8-6

- Update left-menu search input styling, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1539>
- Fix repo search results leading to 404 undefined room, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1540>
- Fix "Chat privately" in user popover not changing left-menu room highlight, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1547>
- Fix room switching in IE11, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1551>
- Provide helpful link to community/room creation docs to the homepage for repo maintainers that are new to Gitter, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1550>
  - Thanks to [@kellytk](https://gitlab.com/kellytk) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1549>

Developer facing:

- Separate serializing for users based on a search term, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1543>
- Update dependency `sinon` to `^7.3.2`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1546>
- Remove unused/orphaned files from `public/` (dead code), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1552>
- Update dependency `useragent` to `2.3.0`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1523>

# 19.59.0 - 2019-7-31

- Show parent message in the thread message feed, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1482>
- Update dependency `@gitterhq/services` to `1.25.0` for [repl.it](https://repl.it/site/docs/classrooms/webhooks) service
  - Thanks to [@kgashok](https://gitlab.com/kgashok) for the contribution, <https://gitlab.com/gitlab-org/gitter/services/merge_requests/104>
- Update @gitterhq/translations to 1.10.1, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1535>
  - Thanks to [@brainsucked](https://github.com/brainsucked) for [contributing a fix to the Bulgarian translation](https://gitlab.com/gitlab-org/gitter/gitter-translations/merge_requests/70)

Developer facing:

- Update dependency `node-uuid@1.4.0` to `uuid@^3.3.2`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1533>
- Move `@gitterhq/services` update process to developer FAQ, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1538>
- Update dependency `parse-diff` to `^0.5.0`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1512>
- Update dependency `core-js` to `v3`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1530>
- Update dependency `redis-lock` to `v0.1.4`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1516>
- Restrict `restSerializer` options to the expected values, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1492>
- Add `parentId` to threaded messages, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1490>
- Programmatically globally load KaTeX fonts, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1534>

# 19.58.0 - 2019-7-29

- Add expand/collapse transition to Vue left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1532>
- Fix left-menu collapsed(pinned/unpinned) leaving blank space in Safari, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1531>

Developer facing:

- Add some end-to-end(e2e) tests running in Cypress(not Selenium), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1480>
- Add automatic dependency updates via Renovate, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1493>
- Update dependency `random-seed` to `^0.3.0`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1515>
- Update dependency `proxyquire` to `v0.6.0`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1514>
- Update dependency `oauth2orize` to `~1.11.0`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1510>

# 19.57.0 - 2019-7-24

- Update left-menu on mobile to be completely hidden and swipe-out/pull, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1487>
- Single boot script for embedded chat, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1489>

# 19.56.0 - 2019-7-21

- Replace underscore with lodash, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1429>
- Add chat input to the thread message feed, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1469>
- Add new message activity indicator for muted room with the Vue left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1486>

Developer facing:

- Validate Vue code style in CI, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1476>
- Make unused variable in the code an error, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1477>
  - Fix Express error handler middleware (needs 4 arguments), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1485>
- Add test for deleting integrations, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1479>
- Add user ID to find-users-by-email script, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1478>
- Update `prettier@1.18.2` dependency, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1484>
- Clean up server side code before placing chat messages to Vuex store, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1481>

# 19.55.1 - 2019-7-18

- Fix XSS on OAuth app authorize page, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2043>
  - Thanks to [`yipman`](https://hackerone.com/yipman) for [responsibly disclosing](https://about.gitlab.com/security/disclosure/) this vulnerability to us.
  - <https://dev.gitlab.org/gitlab/gitter/webapp/merge_requests/14>

# 19.55.0 - 2019-7-10

- Add thread message feed, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1460>
- Fix Vue left-menu search results being too dark with dark theme (contrast), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1471>
- Fix room list scrolling on mobile with the Vue left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1473>
- Fix clicking outside profile menu should close it, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1472>

Developer facing:

- Rename `updateRoom` to `upsertRoom` (VueX action), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1468>
- Documenting implementation of sending and receiving messages, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1459>
- Only support new style Transloadit template with `original_final` (community avatar uploads), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1470>

# 19.54.1 - 2019-7-7

- Strip exif metadata from community avatars when uploaded, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2035>
  - Thanks to [`apocalyptik`](https://hackerone.com/apocalyptik) for [responsibly disclosing](https://about.gitlab.com/security/disclosure/) this vulnerability to us.
  - <https://dev.gitlab.org/gitlab/gitter/webapp/merge_requests/12>

# 19.54.0 - 2019-7-2

- Add dark-theme support to the Vue left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1463>

Developer facing:

- Restructure `supertest` tests that are running against the app, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1455>
- Only support the new style Transloadit `files_filtered` `avatar_thumnails_xxx` template (community avatar uploads), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1462>
- Update security release process, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1450>
- Using eslint autofix on our codebase, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1465>
- Extract common mounting code from tests, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1464>

# 19.53.0 - 2019-6-27

- Update `halley@0.7.0` -> `gitter-realtime-client@2.1.0` so `websocket` transport is chosen over `long-polling`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1453>
  - <https://gitlab.com/gitlab-org/gitter/realtime-client/merge_requests/24>
  - <https://gitlab.com/gitlab-org/gitter/halley/merge_requests/10>
- Add unread indicators to all/people menu bar items with the Vue left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1447>
- Add 'Start a thread' option to the chat context menu (threaded conversations), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1448>
- Remove Vue left-menu from `/~embed` view used in Sidecar, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1457>
- Fix room search updating unread count with the Vue left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1456>
- Only hide Vue left-menu when mobile NLI, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1458>

# 19.52.1 - 2019-6-27

- Fix arbitrary file upload via community avatar upload, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2192>
  - Thanks to [`u3mur4`](https://hackerone.com/u3mur4) for [responsibly disclosing](https://about.gitlab.com/security/disclosure/) this vulnerability to us.
  - <https://dev.gitlab.org/gitlab/gitter/webapp/merge_requests/10>

# 19.52.0 - 2019-6-25

- Fix integration settings throwing 500 error, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1451>

Developer facing:

- Also deploy to Next/staging with a `hotfix/` branch(git flow), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1449>

# 19.51.0 - 2019-6-24

- Add stats/metrics for the Vue left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1434>
- Add room favourite drag and drop to the Vue left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1431>
- Add mobile support to the Vue left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1435>
- Add highlight for current room with the Vue left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1439>
- Fix overflow scroll in Firefox with the Vue left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1440>
- Fix SPA room switcher to always just fallback to redirecting the window with the Vue left-menu (navigation, history), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1441>
- Add NLI support to Vue left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1436>
- Fix room search redirecting to non-joined rooms with the Vue left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1438>
- Fix mention in non-joined room so it shows up in the Vue left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1443>
- Be upfront about bugs in the mobile/desktop apps and transparent about what the Gitter team is focusing on, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1444>
- Add ability to hide feature toggles from the [next.gitter.im]](<https://next.gitter.im/>) UI, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1446>

 Developer facing:

- Add execution permissions to `scripts/utils/email-for-user.js`, `scripts/utils/list-group-admins.js` utility scripts (so we can run them on the server), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1442>

# 19.50.1 - 2019-6-25

- Fix room security policy to enforce the "Only GitHub users are allowed to join this room." rule, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2041>
  - Thanks to @cache-money for [responsibly disclosing](https://about.gitlab.com/security/disclosure/) this vulnerability to us.
  - <https://dev.gitlab.org/gitlab/gitter/webapp/merge_requests/7>

# 19.50.0 - 2019-6-20

- Fix profile menu missing on explore page, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1427>
- Fix create room redirection to newly created room with the Vue left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1428>
- Add hide room functionality to room settings dropdown, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1430>
- Add room search to Vue left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1423>
- Removed links to unavailable 3rd party apps
  - Thanks to [@schwedenmut](https://gitlab.com/schwedenmut) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1432>
- Add 10 per day rate-limit to email invites, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1433>

# 19.49.0 - 2019-6-14

- Fix typos throughout codebase
  - Thanks to [@yo](https://gitlab.com/yo) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1409>
  - And another thanks to [@yo](https://gitlab.com/yo) :) for fixing one more typo, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1410>
- Fix production issue caused by code concerned with users in `invited` state, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1406>
- Add jump to message(permalinks) for search in the Vue left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1411>
- Add redirect for room switches for non-chat pages with the Vue left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1412>
- Move message timestamp next to username, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1415>
- Add Vue left-menu to `/home/explore`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1413>
- Add Vue left-menu to `/home/learn`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1422>
- Add Vue left-menu to `/<community>/home`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1421>
- Add necessary styles for views presented by Vue left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1425>

Developer facing:

- Cleanup `user-loader-factory` in `permissions` module, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1424>

# 19.48.0 - 2019-6-4

- Introduce Vue left-menu v1 (behind [`vue-left-menu` feature flag](https://next.gitter.im/)), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1360>

Developer facing:

- Refactor `chat-internal` renderer to use async/await, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1401>
- Add Jest for Vue testing, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1404>
- Update all `test/public-js`(frontend) tests to use Jest, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1405>
- Add utility script to ban user from room, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1402>
- Fix missing `backbone.marionette` dependency when Vue server side rendering (SSR) in production, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1417>
  - Move frontend dependencies from `devDependencies` to `dependencies` in `package.json`

# 19.47.1 - 2019-6-11

- Disable invite/add emails until we add anti-spam measures, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1416>
  - Disabling so we can ask Mandrill to unpause emails and get unread notifications flowing again, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2153>

# 19.47.0 - 2019-5-28

- Fix the Faye/Bayeux and stream API so it doesn't send messages to a user who was removed from a room, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2044>
  - Thanks to @favicon for [responsibly disclosing](https://about.gitlab.com/security/disclosure/) this vulnerability to us.
  - <https://dev.gitlab.org/gitlab/gitter/webapp/merge_requests/3>

Developer facing:

- Update `package.json` `engines` field to specify only Node.js v10 support, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1397>
- Introduce [Vue.js](https://vuejs.org/) into the codebase, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1396>

# 19.46.0 - 2019-5-15

- Fix integration activity XSS, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2068>
  - Thanks to [@mishre](https://gitlab.com/mishre) for [responsibly disclosing](https://about.gitlab.com/security/disclosure/) this vulnerability to us.
  - <https://dev.gitlab.org/gitlab/gitter/webapp/merge_requests/1>

Developer facing:

- Add docs on how to use debug logging for alt-click key not inserting permalink, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1393>
  - Also adds debug logging for alt-click not inserting permalink
- Adding `mongo-express` container for easy database browsing, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1395>

# 19.45.0 - 2019-5-6

- Add docs to clarify when email notifications are sent out, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1383>
- Add docs to clarify why email notifications are not sent when using IRC bridge, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1384>
- Add docs about how to get a permalink to a message, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1385>
- Add permalink functionality to chat archive, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1367>

Developer facing:

- Use npm@6 in CI, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1387>
- Add security harness git hook to restrict pushing to `dev.gitlab.org`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1388>

# 19.44.0 - 2019-4-19

Developer facing:

- Let mobile asset build exit when running `NODE_ENV=prod`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1380>
- Only run flakey tests on release, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1382>

# 19.43.0 - 2019-4-18

Developer facing:

- Fix mobile asset build not using `prod` env (Android, iOS), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1377>

# 19.42.0 - 2019-4-16

- Add documentation on how to manually configure of GitHub organisation integration/activity events
  - Thanks to [@io7m](https://gitlab.com/io7m) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1373>
- Add whitelist of available upgrade GitHub scopes, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2119>
  - <https://gitlab.com/MadLittleMods/webapp/merge_requests/23>

Developer facing:

- Use overlay2 storage driver on Docker build on CI
  - Thanks to [@tnir](https://gitlab.com/tnir) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1372>

# 19.41.0 - 2019-3-29

- Fix error thrown on archive navigation view by missing profile element so that the rest of the JavaScript runs, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1370>
- Fix commit reference short syntax decorations being mangled, `<group>/<project>@<commit sha>`
  - Thanks to [@peterhull90](https://gitlab.com/peterhull90) for the contribution, <https://gitlab.com/gitlab-org/gitter/gitter-marked/merge_requests/11>
  - <https://gitlab.com/gitlab-org/gitter/gitter-markdown-processor/merge_requests/19>
  - <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1371>
- Add better frontend UI feedback around account deletion request, <https://gitlab.com/gitlab-com/gl-infra/production/issues/749>
  - <https://gitlab.com/MadLittleMods/webapp/merge_requests/20>
- Limit concurrency on removing room membership when deleting account, <https://gitlab.com/gitlab-com/gl-infra/production/issues/749>
  - <https://gitlab.com/MadLittleMods/webapp/merge_requests/21>

# 19.40.0 - 2019-3-21

- Fix 500 NPE on community home with `undefined` user still with room membership, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1365>
- Restore user state when user signs in again after removing
  - Thanks to [@green-coder](https://gitlab.com/green-coder) and [@vicek22](https://gitlab.com/vicek22) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1362>
- Add new lines to end of quoted text to separate comments
  - Thanks to [@joserenan](https://gitlab.com/joserenan) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1366>
- Remove Gitter hiring/job link to left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1368>

Developer facing:

- Fix npm install failing on GitHub `backbone-events-standalone` dependency, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1364>

# 19.39.1 - 2019-3-15

- Add character limit to message edit endpoint, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2106>
  - <https://gitlab.com/MadLittleMods/webapp/merge_requests/18>
- Remove email returned by room invite endpoint, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2102>
  - <https://gitlab.com/MadLittleMods/webapp/merge_requests/17>

# 19.39.0 - 2019-3-12

- Use filled in star icon for favorite communities/rooms
  - Thanks to [@vicek22](https://gitlab.com/vicek22) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1351>
- Fix favorite star on community home
  - Thanks to [@vicek22](https://gitlab.com/vicek22) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1354>
- Update `@gitterhq/translations@1.9.1` dependency for Georgian(`ka`) translation fix, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1357>
  - Thanks to [@davitperaze](https://gitlab.com/davitperaze) for the contribution, <https://gitlab.com/gitlab-org/gitter/gitter-translations/merge_requests/69>

Developer facing:

- Add some docs on how to run a subset of tests, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1356>
- Add some comments about possible user states, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1355>
- Update eslint to use ECMAScript 2018 parser (we already Node.js 10)
  - Thanks to [@vicek22](https://gitlab.com/vicek22) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1358>

# 19.38.0 - 2019-2-27

- Make Gitter markdown readme badge snippet visible for all rooms (share modal)
  - Thanks to [@jamesgeorge007](https://gitlab.com/jamesgeorge007) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1324>
- On the homepage, use green caribbean button style for primary room creation action (just like community creation)
  - Thanks to [@gtsiolis](https://gitlab.com/gtsiolis) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1341>
- Update version badge at the top(`DEV`) to link to the GitLab repo
  - Thanks to [@vicek22](https://gitlab.com/vicek22) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1345>
- Update create room primary button(caribbean) style in `/home/explore` for better consistency
  - Thanks to [@gtsiolis](https://gitlab.com/gtsiolis) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1342>
- Update left menu explore button style(jaffa) for better consistency
  - Thanks to [@gtsiolis](https://gitlab.com/gtsiolis) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1350>
- Add "Open Source" link to `webapp` GitLab project repository on the homepage
  - Thanks to [@gtsiolis](https://gitlab.com/gtsiolis) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1346>

Developer facing:

- Fix mobile(Android/iOS) asset CI build missing `webpack-manifest.json`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1347>
- Add docs on how Gitter uses Prettier for styling/formatting(lint), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1348>
- Update `.gitignore` to ignore anything `.env*` related to avoid leaking mis-named files or backup files created by editors
  - Thanks to [@gtsiolis](https://gitlab.com/gtsiolis) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1349>
- Fix `rename-room.js` util scripts so it can move room to a different group/community
  - Thanks to [@vicek22](https://gitlab.com/vicek22) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1344>
- Fix NPE when lowercasing emails on login/new-user, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1352>

# 19.37.1 - 2019-2-26

- Fix CSRF to sign in as another user (OAuth callback),
  - <https://gitlab.com/gitlab-org/gitter/webapp/issues/2074>
  - <https://gitlab.com/gitlab-org/gitter/webapp/issues/2069>

# 19.37.0 - 2019-2-19

- Fix inline code blocks showing vertical scrollbar in the dark theme
  - Thanks to [@tameo](https://gitlab.com/tameo) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1335>

Developer facing:

- Upgrade from webpack v1 to latest webpack v4, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1322>
  - JavaScript chunks/bundles are now dynamically loaded based on webpack build manifest/artifact
- Try larger timeout for flakey GitHub integration tests
  - <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1334>
  - <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1337>
- Remove extraneous `lodash` from frontend webpack bundles (use `underscore`), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1336>

# 19.36.0 - 2019-2-15

- Fix GitLab issue decorations opening in GitHub (404) on mobile, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1321>
- Update `@gitterhq/translations@1.9.0` dependency for Georgian(`ka`) translations
  - Thanks to [@davitperaze](https://gitlab.com/davitperaze) for the contribution, <https://gitlab.com/gitlab-org/gitter/gitter-translations/merge_requests/68>
- Remove GitHub `/login/explain` page
  - Thanks to [@prajwalm2212](https://gitlab.com/prajwalm2212) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1330>
- Trim extra space in invite user input field (email)
  - Thanks to [@prajwalm2212](https://gitlab.com/prajwalm2212) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1329>
  - <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1333>
- Fix breakpoint for login primary button on homepage so only one shows at a time
  - Thanks to [@gokhanap](https://gitlab.com/gokhanap) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1331>
- Fix inviting many users pushing invitation input offscreen
  - Thanks to [@spiffytech](https://gitlab.com/spiffytech) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1327>

Developer facing:

- Remove defunct in-browser tests, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1326>

# 19.35.0 - 2019-1-31

- Update `@gitterhq/translations@1.8.2` dependency for Chinese(`zh`) translation update
  - Thanks to [@imba-tjd](https://gitlab.com/imba-tjd) for the contribution, <https://gitlab.com/gitlab-org/gitter/gitter-translations/merge_requests/66>

Developer facing:

- Add Prettier automatic formatting for simple lint compliance, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1292>

# 19.34.0 - 2019-1-25

- Update `@gitterhq/translations@1.8.1` dependency for Chinese(`zh`) typo fix
  - Thanks to [@nodexy](https://gitlab.com/nodexy) for the contribution, <https://gitlab.com/gitlab-org/gitter/gitter-translations/merge_requests/65>
- Fix `/login/upgrade` CSRF by adding dedicated landing page with "Upgrade" button to `POST` upgrade, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2061>
  - <https://gitlab.com/MadLittleMods/webapp/merge_requests/11>

Developer facing:

- Lowercase persisted emails for easier matching, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1316>
- Remove masked email from `/api/private/check-invite` response, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2064>
  - <https://gitlab.com/MadLittleMods/webapp/merge_requests/10>

# 19.33.0 - 2019-1-11

- Fix left-menu minibar scrollbar track visible on Firefox (annoying in dark theme), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1311>
- Add "What's new?" on profile menu linking to changelog
  - Thanks to [@avelino](https://gitlab.com/avelino) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1300>

Developer facing:

- Update base Docker images to use node@10 and npm@5, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1312>
- Remove authorization code after used to exchange for token (OAuth), <https://gitlab.com/gitlab-org/gitter/webapp/issues/2054>
  - <https://gitlab.com/MadLittleMods/webapp/merge_requests/6>
  - Thanks to [@cache-money](https://hackerone.com/cache-money) for [responsibly disclosing](https://about.gitlab.com/security/disclosure/) this vulnerability to us.
- Rotate and move webhook cypher secret to secrets repo, <https://gitlab.com/gitlab-org/gitter/webapp/issues/2063>
  - <https://gitlab.com/MadLittleMods/webapp/merge_requests/7>
  - <https://gitlab.com/gitlab-org/gitter/gitter-webhooks-handler/merge_requests/27>
  - <https://gitlab.com/gl-gitter/secrets/merge_requests/17>
  - Thanks to [@mishre](https://hackerone.com/mishre) for [responsibly disclosing](https://about.gitlab.com/security/disclosure/) this vulnerability to us.

# 19.32.0 - 2019-1-8

- Update `@gitterhq/translations@1.7.0` dependency for updated Chinese(`zh`) translations
  - Thanks to [@imba-tjd](https://gitlab.com/imba-tjd) for the contribution, <https://gitlab.com/gitlab-org/gitter/gitter-translations/merge_requests/63>
- Update KaTeX dependency to 0.10.0, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1308>
  - Thanks to [@edoverflow](https://hackerone.com/edoverflow) for [responsibly disclosing](https://about.gitlab.com/security/disclosure/) this vulnerability to us.

# 19.31.0 - 2019-1-3

- Fix Korean homepage translation erroring out (500), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1304>
- Add ability to toggle dark theme in mobile app WebFrame (Android)
  - Thanks to [@charafau](https://gitlab.com/charafau) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1232>
  - Also see accompanying Android MR, <https://gitlab.com/gitlab-org/gitter/gitter-android-app/merge_requests/2>

Developer facing:

- Update Elasticsearch highlight `pre_tag` `<m0>` to have matching closing `post_tag` `</m0>`
  - Thanks to [@AdmiralSnyder](https://gitlab.com/AdmiralSnyder) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1303>
- Fix Elasticsearch and MongoDB Docker image builds, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1305>

# 19.30.0 - 2018-12-17

- Rename the default room when you create a community from `Lobby` -> `community`
  - Thanks to [@gtsiolis](https://gitlab.com/gtsiolis) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1293>

Developer facing:

- Fix Mocha not skipping integration tests that have nested `describe`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1294>
  - Fix test failing because before hook still runs when we should skip, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1297>
- Escape message text from chat message reports, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1295>
- Fix "No query solutions" error caused by not using an existing index and `notablescan: true`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1298>

# 19.29.2 - 2018-12-17

- Fix XSS in left-menu room display name, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1301>
  - Thanks to [@amark](https://gitlab.com/amark) for [responsibly disclosing](https://about.gitlab.com/security/disclosure/) this vulnerability to us.

# 19.29.0 - 2018-12-5

- Update footer padding on homepage(`/?redirect=no`) and `/apps` to be more consistent/purposeful
  - Thanks to [@gtsiolis](https://gitlab.com/gtsiolis) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1288>
- Increase star contrast and use yellow for favorite rooms in the left menu
  - Thanks to [@avelino](https://gitlab.com/avelino) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1282>

Developer facing:

- Update readme setup instructions to favor `source .env` and adjust some Node.js install language,
  - Thanks to [@gtsiolis](https://gitlab.com/gtsiolis) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1281>
- Update minimum requirement to npm 6.x
  - Thanks to [@gtsiolis](https://gitlab.com/gtsiolis) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1286>
- Remove unused/orphaned dependencies (dead code), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1289>
- Re-enable validation CI job (fix eslint errors), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1290>

# 19.28.0 - 2018-12-4

- Update readme badger and service URLs in `hbs` templates to point at GitLab projects (previously GitHub)
  - Thanks to [@avelino](https://gitlab.com/avelino) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1280>, <https://gitlab.com/gitlab-org/gitter/docs/merge_requests/57>
- Add more frame policies to disable another site `<iframe>` embedding the app (prevent clickjacking), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1284>, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1287>
  - Thanks to [@harry_mg](https://hackerone.com/harry_mg) for [responsibly disclosing](https://about.gitlab.com/security/disclosure/) this vulnerability to us.

Developer facing:

- Update `obtain-secrets` script to better align with Twitter's new developer site
  - Thanks to [@gtsiolis](https://gitlab.com/gtsiolis) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1278>
- Remove reference to `gulp` in `obtain-secrets` script (just use `npm start`)
  - Thanks to [@gtsiolis](https://gitlab.com/gtsiolis) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1279>
- Remove collapse embeds chat item server-side endpoints, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1276>
- Fix webhooks on [beta](https://beta.gitter.im/) by pointing it at the new `gitter-beta-01`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1283>

# 19.27.0 - 2018-11-27

- Fix period/dot in username breaking mention syntax
  - Thanks to [@hho](https://gitlab.com/hho) for the contribution, <https://gitlab.com/gitlab-org/gitter/gitter-marked/merge_requests/10>
- Fix quoting multi-line messages. Angle bracket `>` added to each line
  - Thanks to [@auua](https://gitlab.com/auua) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1264>
- Remove embeds (link unfurling/expansion), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1275>
  - Embeds were already deprecated and put behind a feature toggle that was defaulted to off, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1223>

Developer facing:

- Fix 404 when trying to delete an [Gitter developer OAuth app](https://developer.gitter.im/apps), <https://gitlab.com/gitlab-org/gitter/developer-gitter-im/merge_requests/19>

# 19.26.0 - 2018-11-19

- Add "Sign in" link to 404 page, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1269>

Developer Facing:

- Build mobile Android/iOS assets in CI for artifact usage in downstream Android/iOS builds, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1272>

# 19.25.0 - 2018-11-15

- Update `/apps` footer to match homepage
  - Thanks to [@auua](https://gitlab.com/auua) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1265>
- Add frame policies to disable another site `<iframe>` embedding the app (prevent clickjacking), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1270>
  - Thanks to [@harry_mg](https://hackerone.com/harry_mg) for [responsibly disclosing](https://about.gitlab.com/security/disclosure/) this vulnerability to us.

 Developer Facing:

- Remove outdated legal docs
  - Thanks to [@gtsiolis](https://gitlab.com/gtsiolis) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1266>
- Update readme to link issue discussing streamlining initial OAuth config setup, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1267>
- Use correct GitLab OAuth redirect URI in `obtain-secrets` script, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1268>

# 19.24.0 - 2018-11-6

Developer Facing:

- Remove root-level config cruft, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1249>
- Add trackable hiring/job posting link for in left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1262>

# 19.23.0 - 2018-11-1

- Add Gitter hiring/job link to left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1252>
- Add docs about notifications not happening on mobile (Android, iOS), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1254>
- Add docs about how to change room security after creation (public/private), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1256>
- Update `@gitterhq/services@1.23.0` dependency with Heroku fixes to only generate an activity event for a completed Heroku app update event
  - Thanks to [@wlach](https://gitlab.com/wlach) for the contribution, <https://gitlab.com/gitlab-org/gitter/services/merge_requests/101>

Developer Facing:

- Link to Gitter spam runbook doc, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1255>
  - Thanks to [@rostrander](https://gitlab.com/rostrander) for creating the runbook
- Remove dead security descriptor updater code, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1259>

# 19.22.0 - 2018-10-29

Developer facing:

- Fix `unreadItemService.removeItem` not working with lean objects causing stuck unreads, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1247>
- Correlate client access stat with segmentable user-agent, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1248>

# 19.21.0 - 2018-9-27

- Update `@gitterhq/services` dependency with Heroku fixes, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1244>
  - Thanks to [@wlach](https://gitlab.com/wlach) for the contribution, <https://gitlab.com/gitlab-org/gitter/services/merge_requests/98>

 Developer facing:

- Gitter iOS app is now open-source, <https://gitlab.com/gitlab-org/gitter/gitter-ios-app>
- Fix `unread-remove-deleted-messages` script so it actually removes stuck unreads, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1245>

# 19.20.0 - 2018-9-18

- Fix null pointer exception -> 500 status error with empty markdown links, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1241>
- Update `jwt-simple` to fix critical npm audit security issue, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1242>

# 19.19.0 - 2018-9-10

- Remove Gitter Topics from the codebase, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1238>

Developer facing:

- Remove orphaned `.js` files, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1239>

# 19.18.0 - 2018-9-5

- Add "Contribute to Gitter" item to profile menu
  - Thanks to [@pdurbin](https://gitlab.com/pdurbin) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1233>
- Update homepage to reflect free without limits for public and private, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1234>

 Developer facing:

- Use Node.js v10 as the default/recommended version
  - <https://gitlab.com/gitlab-org/gitter/webapp/commit/4b1264476a8b770a942b05c1a10aecf8ac69f129>
  - <https://gitlab.com/gl-infra/gitter-infrastructure/merge_requests/57>
- Only initialize notification listener in app frame and add some debug logging, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1235>

# 19.17.0 - 2018-8-20

- Add reporting/flagging of messages, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1226>

# 19.16.0 - 2018-8-15

- Fix terms of service links pointing to Zendesk instead of GitLab, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1227>
- Fix "Gitter from GitLab" footer link styling, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1228>
- Fix links on homepage for Gitter projects (point to GitLab)
  - Thanks to [@MajkelKorczak](https://gitlab.com/MajkelKorczak) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1230>

Developer facing:

- Add message soft-delete (store message in another collection on delete), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1225>

# 19.15.0 - 2018-8-8

- Add feature toggle for embeds and disable by default, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1223>

Developer facing:

- Gitter Android app is now open-source, <https://gitlab.com/gitlab-org/gitter/gitter-android-app>
  - Move Android embedded chat build to cross-platform Gulp scripts, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1218>
  - Separate Android and iOS builds (restore chat input for Android), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1222>

# 19.14.0 - 2018-8-1

- Remove missing 404 rooms from the homepage, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1215>
- Clicking decorated issue will open the link instead of opening the popover, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1217>

Developer facing:

- Fix `new_user` stat not being pushed out and tracked, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1216>

# 19.13.0 - 2018-7-27

- Add GitLab issue decorations, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1077>

Developer facing:

- Update to Mocha@5.x for better debugging, `--inspect` (node inspector devtools), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1212>

# 19.12.0 - 2018-7-23

- Update `@gitterhq/services@1.21.0` (integrations), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1078>
  - Adds Discourse integration
  - Adds The Bug Genie integration

Developer facing:

- `/v1/repo-info?repo=foo%bar` now returns a `204` status code(previously 200) when the given `repo` query parameter can't be found which caused JSON parsing on the frontend to fail, <https://gitlab.com/gitlab-org/gitter/webapp/issues/1948>
- Fix `loading-view.js` NPE when hooking iframe `DOMContentLoaded` event, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1208>
- Stop Elasticsearch `NoConnections` errors being spammed to Sentry, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1209>
- Pass along `additionalData` from `gitter-faye` to Sentry for more context (trying to solve [#1906](https://gitlab.com/gitlab-org/gitter/webapp/issues/1906)), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1210>
  - Update to `@gitterhq/env@0.39.0` to pass additional data to Sentry/raven, <https://gitlab.com/gitlab-org/gitter/env/merge_requests/16>
  - Update to `gitter-faye@1.2.0` to get additional data passed from logger, <https://gitlab.com/gitlab-org/gitter/faye/merge_requests/3>

# 19.11.0 - 2018-7-18

- Persist emails for GitHub users when they sign in, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1095>
  - Add utility script to find a user by email, `node script/utils/find-users-by-email.js --email foo@bar.com`

# 19.10.1 - 2018-7-16

- Fix topics export rate-limit applying globally instead of per-user, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1204>

# 19.10.0 - 2018-7-16

- Add ability to export [topics](https://blog.gitter.im/2016/09/30/introducing-gitter-topics/)
  - Update to `@gitterhq/env@0.38.0` to stream error if headers already sent, <https://gitlab.com/gitlab-org/gitter/env/merge_requests/15>
  - Add utility scripts `scripts/utils/list-group-admins.js` and `scripts/utils/list-admins-of-every-forum.js` to help gather topics/forum admin emails
  - Add utility script `scripts/utils/email-for-user.js` to get an email for a given user

# 19.9.0 - 2018-7-11

- Add ghost option to account deletion in order to disassociate personal data, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1197>
- Add native QML/Qt app to 3rd party app list, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1200>
  - Thanks to [@eklavya](https://gitlab.com/eklavya) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1200>

# 19.8.0 - 2018-6-29

- Restore token revoked logging, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1192>

Developer facing:

- Run integration tests in GitLab CI, <https://gitlab.com/gitlab-org/gitter/webapp/issues/1918>

# 19.7.0 - 2018-6-27

- Emoji typeahead (autocomplete) only appears after two characters have been typed to more easily send a simple emoticon `:p`
  - Thanks to [@jonhoo](https://gitlab.com/jonhoo) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1188>
- Ensure you can admin the auto-selected community before populating create room modal, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1117>

Developer facing:

- Update to `gitter-realtime-client@1.7.0` which has an updated Halley (smart WebSocket client) ([more context](https://gitlab.com/gitlab-org/gitter/webapp/issues/1937#solution)), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1190>
- Update Apple push notification (APN) `prod` and `prod-dev` certificates/keys, <https://gitlab.com/gl-gitter/secrets/merge_requests/9>

# 19.6.0 - 2018-6-18

- Fix revoked desktop client trying to handshake with realtime/websocket/faye server every 2 seconds (update `interval` from 2 seconds to 10 days), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1186>

# 19.5.0 - 2018-6-16

- Fix delete account profile menu action not working on explore page, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1181>
- Update `@gitterhq/translations` dependency to v1.5.0, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1182>

Developer facing:

- Add `scripts/utils/delete-group.js` util script to delete a group/community, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1166>
- Only subscribe to `/v1/token/xxx` Faye endpoint if signed in, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1183>
- Remove token revoked logging because it is filling up disk space on websocket servers, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1185>

# 19.4.0 - 2018-6-11

- Revoke desktop app v2, v3 to prevent token leaks, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1180>
  - Context <https://blog.gitter.im/2018/06/11/gitter-token-leak-security-issue-notification/>
  - Thanks to Dale Higgs for [responsibly disclosing this vulnerability](https://about.gitlab.com/disclosure/) to us
- Update `@gitterhq/translations` dependency to v1.4.3, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1079>

# 19.3.0 - 2018-6-7

- Add ability to delete account, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1169>
- Update code syntax highlighting to have better visual contrast,
  - Thanks to [@TallTed](https://gitlab.com/TallTed) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1174>
- Fix "Sign in with GitLab" not working -> "Failed to fetch user profile", <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1177>

Developer facing:

- Technical debt: Move `server/services/room-service.js` to `gitter-web-rooms` module, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1165>
  - Also create dependent modules: `gitter-web-unread-items`, `gitter-web-push-notifications`, `gitter-web-users`, `gitter-web-chats`, `gitter-web-events`, `gitter-web-email-addresses`, `gitter-web-user-settings`, `gitter-web-email-notifications`
- Update utility script docs to be more copy-pasta friendly, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1173>
- Fix `skip` parameter in the room search API endpoint `/v1/rooms?q=foo&skip=15&limit=3`
  - Thanks to [@nsuchy](https://gitlab.com/nsuchy) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1175>
- Add room `lcUri` to room deletion log warning for easier grepping, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1168>

# 19.2.0 - 2018-5-23

- Add "Terms of Service" profile menu item linking to <https://about.gitlab.com/terms/>, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1161>
- Fix "Allow private repo access" profile menu item not redirecting to GitHub OAuth upgrade flow, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1162>

Developer facing:

- Add developer FAQ, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1163>
  - First FAQ is on how to configure Gitter so you can access it over your local network on separate devices
- Correlate user-agent with OAuth token usage (stats), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1160>

# 19.1.0 - 2018-5-21

- Sign out user when token revoked in realtime, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1155>
- Sign out user when using revoked user-agent, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1157>

Developer facing:

- Update `scripts/utils/auto-remove-from-room.js` to be robust against a room not existing, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1153>
- Add Gitter desktop app v4 OAuth clients (consider internal Gitter client), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1156>

## 19.0.2 - 2018-5-9

- Fix new messages with mentions not appearing in chat list, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1151>

## 19.0.1 - 2018-5-9

- Fix desktop app JavaScript being broken, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1149>

## 19.0.0 - 2018-5-9

- Sign in with GitLab (usernames are suffixed with `_gitlab`), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1076>
- Deploy to beta/production via GitLab CI
  - <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1064>, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1081>, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1099>, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1102>, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1125>
- Add `:slight_smile:` 🙂 emoji
  - Thanks to [@porsager](https://gitlab.com/porsager) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1097>
- Disable emoticons like :) turning into emojis
  - Thanks to [@asmeurer](https://gitlab.com/asmeurer) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1115>
- Fix "Raise an Issue" linking to [deprecated GitHub issue repo](https://github.com/gitterHQ/gitter) instead of [GitLab](https://gitlab.com/gitlab-org/gitter/webapp)
  - Thanks to [@dregad](https://gitlab.com/dregad) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1101>
- Add ability to revoke OAuth clients, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1071>
  - Avoid redirect loop even with forced token authentication, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1132>
- Fix welcome message error thrown when signing in and auto-joining a room via Sidecar, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1085>
- Fix "Repo Info" tab text-color with the dark theme enabled in the right-sidebar, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1083>
- Update repo conflict room creation validation message to be more actionable, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1118>
- Update to `readme-badger@0.3.0` which adds smarter markdown badge insertion (insert alongside other badges)
  - Thanks to [@chinesedfan](https://gitlab.com/chinesedfan) for the contribution, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1116> (see <https://github.com/gitterHQ/readme-badger/pull/44> for the contribution in the `readme-badger` repo)
- Remove "Your organisations" section from the bottom of the conversation list, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1123>
- Fix null-pointer exception (NPE) issue with the issue decorator in the Safari desktop app, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1134>
- Fix new messages not appearing in chat list, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1146>

Developer facing:

- Add `package-lock.json` for consistent and stable dependencies. Document Node.js v6 and npm v5 requirements, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1103>
- Remove anonymous token password. `tokens__anonymousPassword` is now needed in your `.env` file, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1088>
- Add support for Docker Compose, Docker for Mac, Docker for Windows instead of Docker Toolbox, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1084>
- Initially build CSS fileset when using watch task, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1075>
- Re-enable `unhandledrejection` Sentry logging and fix `undefined` messages, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1131>
  - Updated Sentry Raven.js [`raven-js@3.24.2`(<https://www.npmjs.com/package/raven-js>), <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1130>
- Add docs for running on Windows, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1074>
- Restructure and add docs to help get started touching production, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1107>
  - Add more docs about fixing Mongo -> Elasticsearch rivers in production, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1108>
  - Add docs on how to use `deploy-tools/service-tree` and moving projects to GitLab, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1121>
- Friendly iOS notification missing config errors in logs, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1072>
- Fix number based usernames(like `000123`) being passed incorrectly to utility scripts CLI argv, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1089>
- Update to `@gitterhq/styleguide@2.0.0` to fix the static server(on port 5001) not starting up in the local dev environment, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1119>
- Add utility script to send fake unread notification email, `scripts/utils/send-unread-notification-email.js`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1135>
- Update `scripts/utils/rename-group.js` to account for `homeUri`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1133>
  - Rename `scripts/utils/rename-org.js` -> `scripts/utils/rename-group.js` to better represent our current naming for communties internally
- Update to `bluebird@3.5.1`, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1139>
- Update to `@gitterhq/env@0.36.0` to fix Sentry sending errors, <https://gitlab.com/gitlab-org/gitter/webapp/merge_requests/1148>
