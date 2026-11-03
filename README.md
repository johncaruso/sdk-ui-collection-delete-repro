# ServiceNow SDK UI Collection Tombstone Payload Inspection

Reported upstream as [ServiceNow/sdk discussion #153](https://github.com/ServiceNow/sdk/discussions/153).

## Summary

This is a small, **local-only payload structure inspection** for `@servicenow/sdk` 4.14.0. It uses synthetic XML and the public SDK API directly. Verification uses no credentials, instance connection, deployment, or build-output rewriting.

After a positive baseline establishes known identities, the SDK transforms collection tombstones for:

- A form and its `sys_ui_form_section` join, inside `sys_ui_form_sections action="DELETE"`.
- A default/null-view list and its element, inside `sys_ui_list action="DELETE"`.

The SDK parser and generated keys mark the parent and child records deleted. Build and pack preserve the original collection XML byte for byte, including the inner `INSERT_OR_UPDATE` actions. An ordinary parent `sys_ui_form action="DELETE"` is included as a control and stays an ordinary delete.

**Retained inner upsert data alone is not a defect.** This inspection records the payload structure without making a claim about why that data is retained or how an importer will process it. Deletion semantics may be honored without changing the outer-delete/inner-upsert shape.

The runtime defect in the linked upstream report was verified separately: a form (`sys_ui_form`) and its form-section link (`sys_ui_form_section`) were absent after platform deletion, then returned after SDK installation. The existing section (`sys_ui_section`) and section element (`sys_ui_element`) remained present and unchanged throughout. This local inspection does not perform that live check, establish whether the SDK or platform owns the defect, or determine platform fix status. List recreation is not claimed.

## Environment

- `@servicenow/sdk`: exactly `4.14.0` (the only direct dependency)
- Node.js: `v24.14.0`
- npm: `11.9.0`
- OS used: macOS, arm64

`package-lock.json` pins the resolved dependency tree. The unmodified SDK dependency install reported 24 vulnerabilities: 14 moderate and 10 high. No dependency overrides or automatic audit fixes were applied to this reproduction.

## Local Inspection Steps

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

**On SDK 4.14.0, `npm run verify` exits 0** when the observed payload structure and controls match, with:

```text
PAYLOAD_STRUCTURE_OBSERVED: SDK records and keys are deleted; both collection payloads preserve their original inner INSERT_OR_UPDATE bytes in the ZIP. Ordinary DELETE control stays DELETE.
Structure inspection only; retained inner data is not itself a defect. Runtime form recreation requires a separate live check.
```

A setup/build error or an unexpected record, key, payload, or control result still fails verification. Such a failure means the inspection did not match its expected observations; it is not proof of a runtime defect. `verification.txt` records the successful run. Neither success nor failure declares the platform issue fixed.

## Expected Behavior

Deleting a form or list should preserve its intended deletion semantics through a supported export → SDK transform → build → pack → install roundtrip. A deleted form and join should remain absent after installation. This inspection does not prescribe rewriting every child action to `DELETE`, discarding export history, or any particular workaround.

To establish recreation, a live test must first prove the original form/join existed, then prove they were deleted, and finally show them returning after installation. A successful install tracker or an absent-to-absent result is insufficient to establish recreation.

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
