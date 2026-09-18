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

test("burgerun fixed menu takes the first price", () => {
  const html = `<table class="menu-table"><tbody><tr>
    <td class="title">* 버거운버거 (878-9288)</td>
    <td class="lunch">
      <p>&lt;BURGER&gt;</p>
      <p>불고기버거 : 4,400원 / 6,900원 / 매운맛 변경 +300원</p>
      <p>한입떡복이 세트 - 16,700원</p>
      <p>후라이드치킨 : 10,900원 / 순살 변경 + 1,000원</p>
      <p>※ 운영시간 : 09:00~20:00</p>
    </td>
  </tr></tbody></table>`;

  const payloads = buildSnucoPayloads(html, "2026-07-23");

  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].restaurant, "버거운버거");
  assert.deepEqual(payloads[0].meals, [
    { price: 4400, no_meat: false, menus: ["불고기버거"] },
    { price: 16700, no_meat: false, menus: ["한입떡복이 세트"] },
    { price: 10900, no_meat: false, menus: ["후라이드치킨"] },
  ]);
});
