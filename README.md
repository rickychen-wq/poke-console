# Poké Console · Safari Shortcut Edition

A Traditional Chinese, mobile-first operation planner for your own PokéSurvivor `.com` save. Hosted on GitHub Pages with no backend and no login form.

## Why a Safari shortcut?

A connectivity check on 2026-10-20 confirmed that the game's Firebase Authentication API rejects the GitHub Pages referrer with HTTP 403. This site therefore **does not offer direct game login** and does not ask for passwords, tokens or API credentials.

The site only creates a data packet containing the operations you selected. You invoke the supplied shortcut from the Safari share sheet on the actual, already-signed-in `pokesurvivor.com` game page. No referrer headers are forged, no proxy is used, and no game access rules are changed.

**iPhone compatibility is not yet validated on a real device.** First run the supplied read-only probe. If the shortcut's JavaScript environment cannot see the game service, it stops without writing. Do not treat a published static site or a passing unit test as proof of live-game compatibility.

## Use

1. In iPhone Safari, download the ready-made [connection test](shortcut/Poke-Connection-Test.shortcut) and [operation shortcut](shortcut/Poke-Console.shortcut). Open the downloads (or use Files → Downloads) and tap **Add Shortcut**. Apple requires the user to confirm adding; the website cannot silently install a shortcut.
2. On the already-signed-in game main menu, open Safari's share sheet and run **Poké 連線測試** (the imported name may be `Poke-Connection-Test`). `supported`, `gameService` and `signedIn` must all be `true` before continuing. The probe is read-only.
3. On the website, build your plan, review it, and copy its numeric operation packet.
4. Switch to the signed-in game main menu, share to **Poké Console** (or `Poke-Console`), and wait for its result. Only `ok: true` represents verified server save success. Refresh the game after success.

The installed shortcut already contains Get Clipboard → Match Text (`^[0-9]{3,60000}$`) → Run JavaScript on Webpage → Show Result. The numeric output is connected as a real magic variable, and the JavaScript action's webpage input is connected to the original Safari webpage. **No manual code editing is required.** The website retains manual setup instructions and source-copy controls as an alternative.

The `.shortcut` files were signed for `anyone` using [Shortcuty's documented signing service](https://github.com/Shortcuty/Signing-Server-API-Documentation). Only the public, generated workflow source was submitted; no game account or authentication data was submitted. `shortcut/signing-manifest.json` records the provider, uploaded-source SHA-256, signed-file SHA-256 and file sizes. Tests reject stale sources or changed downloads. These transport and integrity checks do not replace Apple's import validation or real-device testing.

The shortcut may require the user to enable Allow Running Scripts in iPhone Shortcuts settings and grant access to this game page. The user decides whether to grant this permission. Review the source before enabling it.

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
- `scripts/build-shortcut.mjs`: generates the JavaScript, unsigned XML plists and reviewable workflow JSON.
- `scripts/shortcut-package.mjs`: wires Safari input and UTF-16 magic-variable attachments into deterministic workflow packages.
- `scripts/sign-shortcuts.mjs`: explicitly uploads only public workflow source to the signing service; validates returned hashes before replacing both downloads.
- `shortcut/*.shortcut`: signed downloads; `*.unsigned.plist` and `*.workflow.json` are the matching readable sources.
- `tests/`: ledger tests, identity scoping, moderation preservation, oversized-plan rejection and complete generated-shortcut simulations with an offline fake service.

Automated browser preview access was denied, so no browser-based visual QA or real iPhone Safari test was performed during this run. Programmatic unit tests use synthetic local fixtures and do not access a user's game account.

## Attribution

The supported-ID list, legendary classification and upgrade limits describe the public game at <https://pokesurvivor.com/>. Traditional Chinese names come from the [PokeAPI dataset](https://github.com/PokeAPI/pokeapi/blob/master/data/v2/csv/pokemon_species_names.csv). No game graphics, sprites or original application bundle are included. The logo and interface graphics are original vector artwork.

This is an independent personal tool, not an official game website or Pokémon product. Pokémon names and trademarks belong to their respective owners.
