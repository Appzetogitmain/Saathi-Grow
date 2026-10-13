App-open announcements
======================

Publish through App Settings or the notification composer. Publishing from
notifications requires MANAGE_SETTINGS (or Admin role) and a users/all broadcast.
Ordinary notifications keep their existing delivery path and do not require
settings permission. Product/category destinations must identify a published
product or active category; enabled campaigns require HTTPS image URLs. Custom destinations accept
local routes or HTTP(S) URLs, excluding unsafe schemes and protocol-relative URLs.

An unchanged popup keeps its version when saving unrelated settings. Changed
popup content receives a new UUID; stale edits receive HTTP 409. The App Settings
screen omits popup data from unrelated saves, preserving announcements published
in another window. Explicitly publishing a notification creates a new campaign.

Notification record and popup publishing commit together before push dispatch.
This combined operation requires MongoDB transactions (replica set/Atlas or a
sharded cluster). If either database write fails, the request reports failure
and no push is dispatched. Ordinary notifications do not use this transaction.
No new database migration or index is required for app-open announcements.

Customer behavior is once per campaign per browser. Close, backdrop, Escape,
Continue browsing and CTA all dismiss the campaign. Denied storage falls back
to dismissal in memory for the current visit. Announcements wait for login,
location, search, cart and other dialogs, and share a promotion slot with the
app-download prompt. Checkout/auth/tracking and other protected flows suppress
announcements. Foreground/visibility/page-show events refresh public settings,
and visible pages check every minute without refreshing the catalog or cart.

Cards scroll internally on short screens, keep the close button reachable,
label the dialog in both image/text modes, trap keyboard focus and restore focus
on close. A changed image/campaign retries after an earlier image load failure.

Checks:

    cd Backend
    npm test
    npm run check:syntax
    cd ../Frontend
    npm test
    npm run build
    node scripts/check-app-popup-browser.mjs

The browser acceptance check uses installed Chrome (override POPUP_CHROME_PATH
if necessary), production React components and mocked API/store/cart data. It
does not send notifications or connect to a live backend. It writes temporary
Chrome profile data under Frontend/.popup-browser-check, which may be removed
after the check. Live database transaction and FCM acceptance should be verified
with staging test accounts before production rollout.
