import assert from "node:assert/strict";
import test from "node:test";
import { buildSnucoPayloads, generalize301 } from "./snuco.js";

test("301 OR options expand as a cartesian product", () => {
  const [payload] = generalize301([
    {
      type: "LU",
      lines: ["<식사>", "A OR B, C OR D : 6,000원"],
    },
  ]);
  assert.equal(payload.restaurant, "301동식당 일반");
  assert.deepEqual(
    payload.meals.map(({ menus }) => menus),
    [
      ["A", "C"],
      ["A", "D"],
      ["B", "C"],
      ["B", "D"],
    ],
  );
});

test("duplicate cafeteria rows keep the last menu", () => {
  const row = (menu: string, price: number): string => `
    <tr>
      <td class="title">* 220동식당 (887-1123)</td>
      <td class="breakfast">
        <p>&lt;경성 돈카츠&gt;</p>
        <p>${menu} : ${price.toLocaleString("en-US")}원</p>
      </td>
    </tr>`;
  const html = `<table class="menu-table"><tbody>${row("Old menu", 1000)}${row(
    "Current menu",
    2000,
  )}</tbody></table>`;

  const payloads = buildSnucoPayloads(html, "2026-07-23");

  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].restaurant, "220동식당 경성 돈카츠");
  assert.deepEqual(payloads[0].meals, [{ price: 2000, no_meat: false, menus: ["Current menu"] }]);
});
