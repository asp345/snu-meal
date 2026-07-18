import assert from "node:assert/strict";
import test from "node:test";
import { buildVetPayloads, parseVetDate } from "./vet.js";

test("VET dates roll over the reference year", () => {
  assert.equal(parseVetDate("12. 29(월)", "2026-01-02"), "2025-12-29");
  assert.equal(parseVetDate("1. 1(목)", "2026-01-02"), "2026-01-01");
  assert.equal(parseVetDate("점심", "2026-01-02"), undefined);
});

test("VET applies the global dinner menu to every dated lunch row", () => {
  const html = `
    <table>
      <tr><th>날짜</th><th>점심</th><th>비고</th></tr>
      <tr><td>12. 29(월)</td><td>: 제육볶음</td><td></td></tr>
      <tr><td>1. 1(목)</td><td>없음</td><td></td></tr>
    </table>
    <p>저녁메뉴 : 김치찌개</p>
    <table><tr><td>ignored</td><td>ignored</td><td>ignored</td></tr></table>
  `;
  const payloads = buildVetPayloads(html, "2026-01-02");
  assert.deepEqual(payloads, [
    {
      restaurant: "수의대식당",
      date: "2025-12-29",
      type: "LU",
      meals: [{ price: null, no_meat: false, menus: ["제육볶음"] }],
    },
    {
      restaurant: "수의대식당",
      date: "2025-12-29",
      type: "DN",
      meals: [{ price: null, no_meat: false, menus: ["김치찌개"] }],
    },
    {
      restaurant: "수의대식당",
      date: "2026-01-01",
      type: "DN",
      meals: [{ price: null, no_meat: false, menus: ["김치찌개"] }],
    },
  ]);
});
