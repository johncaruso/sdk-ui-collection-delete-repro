# ServiceNow SDK UI Collection Delete Repro

## Summary

This is a small, **local-only** reproduction of a packaging condition in `@servicenow/sdk` 4.14.0. It uses synthetic XML and the public SDK API directly. No other CLI, credentials, instance connection, deployment, or build-output rewriting is involved.

After a positive baseline establishes known identities, the SDK transforms collection tombstones for:

- A form and its `sys_ui_form_section` join, inside `sys_ui_form_sections action="DELETE"`.
- A default/null-view list and its element, inside `sys_ui_list action="DELETE"`.

The SDK parser and generated keys mark the parent and child records deleted. However, build and pack preserve the original collection XML byte for byte, including the inner `INSERT_OR_UPDATE` actions. An ordinary parent `sys_ui_form action="DELETE"` is included as a control and stays an ordinary delete.

This demonstrates a difference between the SDK's parsed deletion state and its emitted payload shape. **It does not by itself establish how a platform importer will process that shape, prove form/list recreation, or determine whether a platform release fixes the behavior.** In particular, list recreation is not claimed. Deletion semantics may be honored by an importer without changing the outer-delete/inner-upsert shape.

## Environment

- `@servicenow/sdk`: exactly `4.14.0` (the only direct dependency)
- Node.js: `v24.14.0`
- npm: `11.9.0`
- OS used: macOS, arm64

`package-lock.json` pins the resolved dependency tree. The unmodified SDK dependency install reported 24 vulnerabilities: 14 moderate and 10 high. No dependency overrides or automatic audit fixes were applied to this reproduction.

## Repro Steps

```sh
npm install
npm run verify
```

After the initial install, verification requires no network access or credentials. The scripts reject network attempts and disable SDK telemetry. `npm ci` can be used with the committed lockfile for a clean install.

`verify` runs these individually available steps:

```sh
npm run transform
npm run build
npm run assert
```

1. `transform` resets only this repo's generated directories, copies `fixtures/baseline` into `metadata`, and builds that positive baseline to create genuine SDK keys. It then transforms the unchanged tombstones from `fixtures/metadata/author_elective_update`. This models an earlier pull: the SDK ignores deletes for identities it has never seen.
2. `build` invokes public SDK build, pack, and unpack APIs. It does not edit any emitted XML or ZIP entry.
3. `assert` checks all five parsed records and keys are deleted, source metadata and packed bytes, and the ordinary-delete control. Details are written under ignored `results/`.

**On SDK 4.14.0, `npm run verify` intentionally exits 1** after successful transform and build, with:

```text
PACKAGING_CONDITION_REPRODUCED: SDK records and keys are deleted, but both collection payloads retain their original inner INSERT_OR_UPDATE bytes in the ZIP. Ordinary DELETE control stays DELETE.
Local packaging evidence only; this does not prove form/list recreation or determine platform fix status.
```

An unrelated setup/build/assertion failure has a separate error and must not be counted as a reproduction. `verification.txt` records the observed run. If the checked serialization condition changes, the script reports `PACKAGING_CONDITION_NOT_REPRODUCED`; that still requires review and live qualification, and is not a declaration that the platform issue is fixed.

## Expected Behavior

Deleting a form or list should preserve its intended deletion semantics through a supported export → SDK transform → build → pack → install roundtrip. The SDK's deletion state and the installer's interpretation need to agree. This reproduction does not prescribe rewriting every child action to `DELETE`, discarding export history, or any particular workaround.

The emitted collection shape is the local condition to inspect. To establish recreation, a live test must first prove the original form/join existed, then prove they were deleted, and finally show them returning after installation. A successful install tracker or an absent-to-absent result is insufficient.

## Fixtures and Local Evidence

All IDs, scope names, table names, and view names are synthetic. The three positive baseline files and three deletion files are deliberately small; they contain no private exports or update-history records. The default-list fixture uses an empty wrapper view and the inner display value `Default view`, matching a default/null-view collection shape.

| File | Purpose |
| --- | --- |
| `sys_ui_form_sections_11111111111111111111111111111111.xml` | Form `111…` and join `222…` collection tombstone |
| `sys_ui_list_x_repro_ui_delete_probe_null.xml` | Default/null list `333…` and element `444…` collection tombstone |
| `sys_ui_form_55555555555555555555555555555555.xml` | Ordinary parent-delete control |
| `results/transform.json` | Parsed record deletion flags, generated key deletion flags, input hashes |
| `results/build.json` | ZIP hash, direct SDK build/pack evidence, parsed records and keys after build |
| `results/assertion.json` | Byte comparisons and local assertion result |

The positive fixtures are inputs for local SDK identity registration only. They omit a full application/table/view/section schema and are **not a deployable sample app**. Do not install this repository's synthetic ZIP on an instance. No install or authentication script is provided.

## Optional Maintainer Live Check

Use your **own disposable instance and fresh application scope**, not this repo's synthetic IDs or package. This optional check is manual; `verify` never performs it.

1. In that scope, create a small table with a `name` field, named view, form, section, section element, and form-section join. Record actual IDs and logical table/view keys, and preserve a positive exported baseline.
2. Delete only that form using the platform's normal supported operation. Export the resulting collection tombstone unchanged. Hash it and confirm the form/join are absent while section/element/view remain.
3. Use an isolated SDK 4.14.0 project for **your scope**, with the earlier positive baseline/keys already established. Transform your real export locally, then build and pack. Retain raw XML/history, generated keys, SDK/platform versions and the ZIP hash; compare parser deletion flags with the packaged XML. Check `npx now-sdk transform --help`, `build --help`, and `install --help` for your installed version before invoking them.
4. Keep the form/join deleted and verify both original IDs and logical identities are absent immediately before installation. Install the built deletion package **once** using the SDK's supported install path and an explicit alias for your disposable instance; wait for a terminal tracker result. Do not deploy this repository's synthetic package.
5. Query both original IDs and logical table/view identities plus all join references. Expected: form/join absent, no replacement form, section/element/view retained, unrelated list rows unchanged. Preserve before/after snapshots and tracker results. Stop to inspect failures or uncertain outcomes before any retry.

For steps 3 and 4, SDK 4.14.0 provides the following commands. Run these only from **your own export project**, and verify the form/join remain deleted between build and install:

```sh
npx now-sdk transform --from ./YOUR_EXPORTED_TOMBSTONE.xml
npx now-sdk build
# Verify both original and logical form/join identities are absent before this one install:
npx now-sdk install --auth YOUR_DISPOSABLE_ALIAS --demoData=false --skip-flow-activation
```

That live check establishes importer behavior separately from this local packaging check. Application Repository promotion is another path and needs its own qualification; it is not exercised here.
