# Poké Console · Safari Shortcut Edition

A Traditional Chinese, mobile-first operation planner for your own PokéSurvivor `.com` save. Hosted on GitHub Pages with no backend and no login form.

## Why a Safari shortcut?

A connectivity check on 2026-10-20 confirmed that the game's Firebase Authentication API rejects the GitHub Pages referrer with HTTP 403. This site therefore **does not offer direct game login** and does not ask for passwords, tokens or API credentials.

The site only creates a data packet containing the operations you selected. You invoke the supplied shortcut from the Safari share sheet on the actual, already-signed-in `pokesurvivor.com` game page. No referrer headers are forged, no proxy is used, and no game access rules are changed.

**The current shortcut failed to access the game service on a real iPhone.** A user-supplied 2026-10-20 screenshot shows `supported: true`, `gameService: false`. The old probe sets `signedIn: false` whenever the service is unavailable, so that value does not prove the player is signed out. First run the supplied read-only probe. If the shortcut's JavaScript environment cannot see the game service, it stops without writing. Do not treat a published static site or a passing unit test as proof of live-game compatibility.

## Use

1. In iPhone Safari, download the ready-made [connection test](shortcut/Poke-Connection-Test-v2.shortcut) and [operation shortcut](shortcut/Poke-Console-v2.shortcut). Open the downloads (or use Files → Downloads) and tap **Add Shortcut**. Apple requires the user to confirm adding; the website cannot silently install a shortcut.
2. On the already-signed-in game main menu, open Safari's share sheet and run **Poké 連線測試 v2** (the imported name may be `Poke-Connection-Test-v2`). `supported`, `gameService` and `signedIn` must all be `true` before continuing. The probe is read-only.
3. On the website, build your plan, review it, and copy its numeric operation packet.
4. Switch to the signed-in game main menu, share to **Poké Console v2** (or `Poke-Console-v2`), and wait for its result. Only `ok: true` represents verified server save success. Refresh the game after success.

The installed shortcut already contains Get Clipboard → Match Text (`^[0-9]{3,60000}$`) → Run JavaScript on Webpage → Show Result. The numeric output is connected as a real magic variable, and the JavaScript action's webpage input is connected to the original Safari webpage. **No manual code editing is required.** The website retains manual setup instructions and source-copy controls as an alternative.

The `.shortcut` files were signed for `anyone` using [Shortcuty's documented signing service](https://github.com/Shortcuty/Signing-Server-API-Documentation). Only the public, generated workflow source was submitted; no game account or authentication data was submitted. `shortcut/signing-manifest.json` records the provider, uploaded-source SHA-256, signed-file SHA-256 and file sizes. Tests reject stale sources or changed downloads. These transport and integrity checks do not replace Apple's import validation or real-device testing.

The shortcut may require the user to enable Allow Running Scripts in iPhone Shortcuts settings and grant access to this game page. The user decides whether to grant this permission. Review the source before enabling it.

## v2 input wiring correction

Reinstall both signed v2 shortcuts if you installed the initial release. The first package incorrectly placed Match Text's clipboard input in `WFInput`; this action requires the lowercase `text` slot. Both shortcuts also used a bare `WFTextTokenAttachment` for Show Result's `Text`, which requires a `WFTextTokenString`. Those disconnected inputs can explain a manual text prompt or missing output; the exact phone dialog has not yet been observed.

The correction follows independently decoded Apple action slots in [shortcut-lib's observed envelope corpus](https://github.com/findlaywebb/shortcut-lib/blob/main/data/observed_envelope_types.json). Regression tests explicitly reject the original field name and wrapper, and trace an actual 500-ticket numeric packet from the clipboard through the generated workflow. This is an offline format check, not a real iPhone execution test.

The `-v2.shortcut` downloads have distinct filenames so users can choose the repaired shortcuts. Original download paths serve the same corrected bytes for compatibility; the signing manifest includes and checks both names. Run Test v2 from the signed-in game's Safari share sheet before using Console v2. Neither shortcut needs a manually entered number.

## Read-only module diagnostic

The new [Poke-Module-Test.shortcut](shortcut/Poke-Module-Test.shortcut) investigates a separate approach. It imports Firebase 13.0.0 modules from Google's official `www.gstatic.com` CDN, uses the public Firebase config already shipped by the game, and asks the SDK to restore an existing same-origin Auth session using its supported persistence implementations. It never requests a password, exports an authentication token, forges a referrer, logs in as another user, or invokes a Firestore write API.

If restoration succeeds, it reads only `saves/{auth.currentUser.uid}` from the server. Output contains capability/stage flags and resource totals, with no UID, email, profile name or tokens. A nine-second deadline bounds the diagnostic; cloud access is skipped if an earlier phase finishes after the deadline. The SDK may perform its normal session persistence/refresh work; "read-only" refers to game save operations.

Run it from the signed-in game's Safari share sheet without any numeric packet and report its result. **A successful module test does not enable the old operation shortcut**, which still requires the page-global service. This diagnostic has offline unit tests but still requires a real iPhone execution to establish whether module loading, session storage and a server read work in that environment. Script isolation is a plausible explanation for the screenshot, consistent with [Apple's content-world documentation](https://developer.apple.com/documentation/webkit/wkcontentworld); the screenshot alone does not distinguish isolation from every other service-loading failure.

The SDK initialization/persistence approach follows [Firebase's custom Auth dependencies documentation](https://firebase.google.com/docs/auth/web/custom-dependencies). The game's CSP currently allows `https://www.gstatic.com`; all three exact module URLs returned HTTP 200 with CORS `*` during development. Those HTTP checks do not prove they can be imported by iPhone Shortcuts.

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
- `data/catalog.json`: 966 supported Pokémon, 87 legendary flags, 14 current upgrade limits; game bundle `1afa081e93`, checked 2026-10-20.
- `js/module-probe.js`: read-only alternative-session diagnostic; independent from the operation shortcut.
- `scripts/build-shortcut.mjs`: generates the JavaScript, unsigned XML plists and reviewable workflow JSON.
- `scripts/shortcut-package.mjs`: wires Safari input and UTF-16 magic-variable attachments into deterministic workflow packages.
- `scripts/sign-shortcuts.mjs`: explicitly uploads only public workflow source to the signing service; validates returned hashes before replacing the downloads.
- `shortcut/*.shortcut`: signed downloads; `*.unsigned.plist` and `*.workflow.json` are the matching readable sources.
- `tests/`: ledger tests, identity scoping, moderation preservation, oversized-plan rejection and complete generated-shortcut simulations with an offline fake service.

Automated browser preview access was denied, so no browser-based visual QA or real iPhone Safari test was performed during this run. Programmatic unit tests use synthetic local fixtures and do not access a user's game account.

## Attribution

The supported-ID list, legendary classification and upgrade limits describe the public game at <https://pokesurvivor.com/>. Traditional Chinese names come from the [PokeAPI dataset](https://github.com/PokeAPI/pokeapi/blob/master/data/v2/csv/pokemon_species_names.csv). No game graphics, sprites or original application bundle are included. The logo and interface graphics are original vector artwork.

This is an independent personal tool, not an official game website or Pokémon product. Pokémon names and trademarks belong to their respective owners.
