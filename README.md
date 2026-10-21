# Poké Console · Desktop Execution Edition

A Traditional Chinese, mobile-first operation planner for your own PokéSurvivor `.com` save. Hosted on GitHub Pages with no backend and no login form.

## iPhone Safari multiplier compatibility trial (2026-10-21)

Open [the iPhone setup page](https://rickychen-wq.github.io/poke-console/iphone.html). This is a separate userscript experiment, not the retired Shortcuts flow. **An actual iPhone has not passed this route yet.** Do not treat the presence of an install page or passing unit tests as proof of iPhone compatibility, and do not purchase a manager on that assumption.

The self-contained `safari/chen0414-mewtwo.user.js` requests document-start, page/main-world execution. It temporarily observes the game's normal namespace assignment, removes that hook after capture (or a 60-second timeout), and wraps configurable Player getters. Only account `chen0414`'s active Mewtwo (dex 150) receives 10× attack, 5× movement speed and one tenth of ordinary incoming damage. New Player instances use the same wrappers without stacking; disabling restores ordinary getter results. No save fields, auth storage, cloud services or leaderboard writes are used. The browser keeps only an on/off preference.

The game's current cloud save normalization caps supported upgrades, so arbitrary combat multipliers cannot be made into permanent, cross-device account fields. This trial therefore requires an installed browser helper; it does not claim permanent cloud changes.

Game bundle `d2dfaee739` was checked for the DEX/DB/Player-before-Game assignment order. The multiplier core was separately verified against a real paused desktop game and a fresh run: attack ratio 10, speed ratio 5, incoming-damage ratio 0.1. Full document-start injection was not verified in that desktop session because the browser tool does not support registering new-document scripts. Automated tests cover the standalone document-start loader with isolated fixtures, correct account/character scoping, repeated runs, cleanup, runtime conflicts and probe failure modes.

The [compatibility page](https://rickychen-wq.github.io/poke-console/safari-check.html) retains the game's current script CSP. It turns green only when the page's own main-world prototype sees a temporary userscript marker; sharing DOM access or a bridge function from an isolated world does not pass. Passing that page still requires an in-game verified badge, followed by closing/reopening the game tab and checking a new run on the actual iPhone.

[Userscripts documents page-injection/CSP limitations](https://github.com/quoid/userscripts/issues/954); its install instructions alone do not establish support for this game. Use an already-installed manager for the probe when possible. Failed probes stop here; no CSP is removed, permissions are not broadened automatically, and the old Shortcuts module test is not retried.

## Current status and use

The iPhone route did not pass real-device checks: the initial probe could not see the game service, and the module probe subsequently hit the native Shortcuts JavaScript timeout. **Do not keep retrying phone writes or the module test.** The module-test download now returns a synchronous retirement notice without module imports, timers, login or save access. Already-installed copies do not update automatically; stop using the old copy.

Use the computer's existing game session instead:

1. Open `https://pokesurvivor.com/` in desktop Chrome and sign in yourself. Never send passwords to this tool or paste credentials into chat. Keep the game on its main menu; close stale game pages on the phone/other devices first.
2. Copy the site's **電腦只讀檢查**, and execute it in the game tab's DevTools Console. This reads only the signed-in user's own cloud document. Check the resource totals and `ok: true` before proceeding.
3. Build a plan in the planner, review it and generate the execution instructions. Click **複製電腦執行程式**. The copied source contains the reviewed data packet, so there is no second numeric input or login form.
4. Execute the copied source in that same game tab's Console. Only `ok: true` with `cloudVerified: true` means the server re-read matched the requested operations. Immediately refresh the desktop game, then reopen the phone game at the same URL and use the same account. Phone synchronization still needs verification on the actual account.

The desktop executor is a self-contained script built from the same save transformation and owner-scoped service used in unit tests. It fetches no scripts, exports no credentials, respects the local save interval and preserves unrelated document fields. Its template accepts only a validated numeric packet. The preview and website do not write to a game account. This desktop path has offline tests; no real account write or desktop browser execution has been verified in this release.

A prior connectivity check confirmed that Firebase Authentication rejects the GitHub Pages referrer with HTTP 403. This site therefore does not offer game login. No referrer headers are forged, no proxy is used, and no game access rules are changed.

Archived shortcut sources and signed downloads remain for review. The `.shortcut` files were signed for `anyone` using [Shortcuty's documented signing service](https://github.com/Shortcuty/Signing-Server-API-Documentation), uploading only public workflow source. The signing manifest checks exact source/output hashes. These file checks do not establish live compatibility.

## v2 input wiring correction

Reinstall both signed v2 shortcuts if you installed the initial release. The first package incorrectly placed Match Text's clipboard input in `WFInput`; this action requires the lowercase `text` slot. Both shortcuts also used a bare `WFTextTokenAttachment` for Show Result's `Text`, which requires a `WFTextTokenString`. Those disconnected inputs can explain a manual text prompt or missing output; the exact phone dialog has not yet been observed.

The correction follows independently decoded Apple action slots in [shortcut-lib's observed envelope corpus](https://github.com/findlaywebb/shortcut-lib/blob/main/data/observed_envelope_types.json). Regression tests explicitly reject the original field name and wrapper, and trace an actual 500-ticket numeric packet from the clipboard through the generated workflow. This is an offline format check, not a real iPhone execution test.

The `-v2.shortcut` downloads have distinct filenames so users can choose the repaired shortcuts. Original download paths serve the same corrected bytes for compatibility; the signing manifest includes and checks both names. Run Test v2 from the signed-in game's Safari share sheet before using Console v2. Neither shortcut needs a manually entered number.

## Retired phone module diagnostic

The experimental `js/module-probe.js` restored same-origin Auth with official Firebase modules and attempted an owner-only server read. Its nine-second application watchdog did not produce a result before the user's native Shortcuts timeout. [Apple documents that multi-second waits can exceed the JavaScript action's time limit](https://support.apple.com/guide/shortcuts/intro-to-the-run-javascript-on-webpage-action-apd218e2187d/ios). We cannot determine the exact stalled stage from that screenshot, and cannot claim the SDK or session restoration succeeded.

The downloadable `Poke-Module-Test.shortcut` has been retired to an immediate, synchronous status response. `js/module-probe.js` remains experimental reference code with offline tests, not the active iPhone entry point. The site prioritizes desktop instructions and archives the old phone instructions.

## What the site does

- Resource totals: gold, regular tickets and ten-pull tickets. Blank resource inputs mean **leave unchanged**; zero is an explicit target.
- Collection: search 966 supported Pokémon by Traditional Chinese name, English name or ID; select ordinary and shiny collection unlocks.
- Upgrades: select a specific partner or all 87 Pokémon with the game's legendary flag. There is no all-966-upgrades button.
- Preview and generate an operation packet. The site never displays a generated packet as an already-saved game change.
- Download a **plan preview**; it is not a game-save backup.
- Separate demo mode runs against an in-memory sample save and never connects to the game.

The planner starts with no knowledge of the user's real game values. Its counters are proposed values, not live account balances. The numeric packet encodes JSON data, not JavaScript.

## Shortcut safeguards

- Runs only on `pokesurvivor.com` / `www.pokesurvivor.com` and requires the game's existing Firebase service and signed-in user.
- Targets only `saves/{authenticatedUser.uid}`; no input can choose another account.
- Reads the latest document inside a Firestore transaction and updates only `save` and `updatedAt`. Moderation flags and unrelated document fields are preserved. Accounts marked `ban: true` are not changed.
- Uses the game's earned/spent ledger keys (`c`, `t1`, `t10`) along with resource totals. Repeated targets are idempotent.
- Preserves existing collection dates, unrelated profile/statistics fields and other characters' upgrades.
- Rejects oversized plans using a conservative structural index estimate and payload check. The server remains authoritative; its exact indexing configuration is not known.
- Honors the game's 65-second local save interval. No retry storm or timer is installed by the shortcut.
- Re-reads from the server and verifies the requested fields before reporting success.
- After a successful write, attempts to retain the pre-write save in the game origin's local storage under `ps.console.backup.{uid}`. A backup cannot guarantee a full rollback under the game's merge rules.
- Never exports authentication tokens or passwords. The result contains only the player name and save summary.
- Does not modify leaderboards, fabricate play statistics, or clear account moderation flags.

Modifying a game save may violate game rules and can result in account action. This project provides no ban-safety guarantee.

## Development

Node.js 22+; no dependencies or build installation required.

```sh
npm run dev
npm run check
npm test
# After changing the embedded shortcut source, explicitly re-sign before release:
npm run sign:shortcuts
```

`npm run check` regenerates the self-contained shortcut from the same transformation code used by the planner and demo, then checks syntax, catalog counts, HTML IDs and references. The site is buildless and served from the repository root by GitHub Pages.

- `js/core.js`: independent save transformation and validation logic.
- `js/packet.js`: strictly typed, digits-only operation packet encoding/decoding.
- `js/service.js`: game-page-only service adapter and isolated demo/planner adapters.
- `js/app.js`: UI, queue and preview flow.
- `iphone.html`, `safari-check.html`, `assets/iphone.css`: experimental Safari setup and main-world check.
- `js/safari-{core,capture,bootstrap}.js`: scoped runtime multipliers and document-start loader; `scripts/build-safari.mjs` generates the standalone userscript.
- `data/catalog.json`: 966 supported Pokémon, 87 legendary flags, 14 current upgrade limits; game bundle `1afa081e93`, checked 2026-10-20.
- `js/module-probe.js`: experimental reference only; retired from the phone download after a native timeout.
- `js/desktop.js`: validates and embeds the reviewed numeric packet into the desktop template.
- `scripts/build-desktop.mjs`: generates the standalone desktop read-only check and plan executor.
- `desktop/`: generated code that users explicitly run in their signed-in game tab.
- `scripts/build-shortcut.mjs`: generates the JavaScript, unsigned XML plists and reviewable workflow JSON.
- `scripts/shortcut-package.mjs`: wires Safari input and UTF-16 magic-variable attachments into deterministic workflow packages.
- `scripts/sign-shortcuts.mjs`: explicitly uploads only public workflow source to the signing service; validates returned hashes before replacing the downloads.
- `shortcut/*.shortcut`: signed downloads; `*.unsigned.plist` and `*.workflow.json` are the matching readable sources.
- `tests/`: ledger tests, identity scoping, moderation preservation, oversized-plan rejection and complete generated-shortcut simulations with an offline fake service.

Automated browser preview access was denied, so no automated browser visual QA was performed. User-supplied iPhone screenshots document the service-access failure and native JavaScript timeout. Programmatic unit tests use synthetic local fixtures and do not access a user's game account.

## Attribution

The supported-ID list, legendary classification and upgrade limits describe the public game at <https://pokesurvivor.com/>. Traditional Chinese names come from the [PokeAPI dataset](https://github.com/PokeAPI/pokeapi/blob/master/data/v2/csv/pokemon_species_names.csv). No game graphics, sprites or original application bundle are included. The logo and interface graphics are original vector artwork.

This is an independent personal tool, not an official game website or Pokémon product. Pokémon names and trademarks belong to their respective owners.
