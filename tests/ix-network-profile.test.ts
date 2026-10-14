import assert from "node:assert/strict";
import { test } from "node:test";
import { parseIxProfile, readIxProfile, mergeIxProfile, ixProfileNameParts, ixProfileNote } from "../lib/server/ix-network-profile";

const saved = { fullName: "Fixture  Person", phone: "+12025550123", artistName: "Fixture Artist", notes: "Existing note\nSecond line" };

test("v2 normalizes fields without losing the full name or note line breaks", () => {
  const result = parseIxProfile({ intakeVersion: 2, fullName: "  Fixture  Person  ", phone: "+1 (202) 555-0123", artistName: " Fixture Artist ", notes: " Existing note\nSecond line " });
  assert.deepEqual(result, { ok: true, profile: saved });
  assert.deepEqual(ixProfileNameParts(saved.fullName), { firstName: "Fixture", lastName: "Person" });
  assert.match(ixProfileNote(saved), /Full name: Fixture  Person/);
});

test("only explicit v2 profiles may change or clear saved fields", () => {
  for (const intakeVersion of [undefined, 1]) {
    const result = parseIxProfile({ intakeVersion, fullName: "Ignored", phone: "" });
    assert.deepEqual(result, { ok: true, profile: null });
    assert.deepEqual(mergeIxProfile(saved, result.ok ? result.profile : null), saved);
  }
  const omitted = parseIxProfile({ intakeVersion: 2, fullName: "Updated Fixture" });
  assert.equal(omitted.ok, true);
  assert.deepEqual(mergeIxProfile(saved, omitted.ok ? omitted.profile : null), { ...saved, fullName: "Updated Fixture" });
  assert.deepEqual(mergeIxProfile(saved, { fullName: "Updated Fixture", phone: "", notes: "", artistName: "" }), { fullName: "Updated Fixture", phone: "", notes: "", artistName: "" });
  assert.equal(mergeIxProfile(null, null), null);
});

test("required name, limits, types and control characters fail explicitly", () => {
  const cases: [Record<string, unknown>, string][] = [
    [{ intakeVersion: 3 }, "invalid_intake_version"], [{ fullName: undefined }, "full_name_required"], [{ fullName: "  " }, "full_name_required"],
    [{ fullName: null }, "invalid_full_name"], [{ fullName: "n".repeat(121) }, "invalid_full_name"], [{ fullName: "A\nB" }, "invalid_full_name"],
    [{ artistName: "a".repeat(121) }, "invalid_artist_name"], [{ artistName: ["artist"] }, "invalid_artist_name"], [{ artistName: "A\tB" }, "invalid_artist_name"],
    [{ notes: "n".repeat(2001) }, "invalid_notes"], [{ notes: "note\0" }, "invalid_notes"], [{ notes: null }, "invalid_notes"],
  ];
  for (const [change, error] of cases) assert.deepEqual(parseIxProfile({ intakeVersion: 2, fullName: "Fixture", ...change }), { ok: false, error });
  assert.equal(parseIxProfile({ intakeVersion: 2, fullName: "n".repeat(120), artistName: "a".repeat(120), notes: "n".repeat(2000) }).ok, true);
});

test("phone accepts only a bounded dialable number and formatting", () => {
  for (const phone of ["123456", "1".repeat(16), "2025550123 ext4", "++12025550123", "1202+5550123", "2025550123\n", 1234567890, null, " ".repeat(41)]) {
    assert.deepEqual(parseIxProfile({ intakeVersion: 2, fullName: "Fixture", phone }), { ok: false, error: "invalid_phone" });
  }
  for (const phone of ["1234567", "+" + "1".repeat(15), "", "202.555.0123"]) assert.equal(parseIxProfile({ intakeVersion: 2, fullName: "Fixture", phone }).ok, true);
});

test("stored profiles are validated before use in mirrors or notifications", () => {
  assert.deepEqual(readIxProfile(saved), saved);
  for (const value of [null, [], "profile", { fullName: "" }, { fullName: "Incomplete" }, { ...saved, phone: "not a number" }]) assert.equal(readIxProfile(value), null);
});
