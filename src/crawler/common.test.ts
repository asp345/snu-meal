import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeNames,
  normalizePrice,
  OPTIONAL_COLON_PRICE_RE,
  parsePriceLine,
} from "./common.js";

test("common price and name parsing", () => {
  assert.deepEqual(parsePriceLine("제육볶음 & 된장국(#) : 6,000원"), {
    price: 6000,
    no_meat: true,
    menus: ["제육볶음", "된장국"],
  });
  assert.deepEqual(parsePriceLine("우동 5,000원", OPTIONAL_COLON_PRICE_RE), {
    price: 5000,
    no_meat: false,
    menus: ["우동"],
  });
  assert.deepEqual(parsePriceLine("비빔밥(#) : 5,500원"), {
    price: 5500,
    no_meat: true,
    menus: ["비빔밥"],
  });
  assert.deepEqual(parsePriceLine("순두부찌개[#] : 5,000원"), {
    price: 5000,
    no_meat: true,
    menus: ["순두부찌개"],
  });
  assert.deepEqual(parsePriceLine("야채라면# : 3,500원"), {
    price: 3500,
    no_meat: true,
    menus: ["야채라면"],
  });
  assert.deepEqual(normalizeNames(" 김밥[#], 라면 * 단무지 "), ["김밥", "라면", "단무지"]);
  assert.equal(parsePriceLine("가격 없음"), undefined);
});

test("extra zero price typos are corrected", () => {
  assert.equal(normalizePrice(8300), 8300);
  assert.deepEqual(parsePriceLine("호구세트 : 8,3000원"), {
    price: 8300,
    no_meat: false,
    menus: ["호구세트"],
  });
});
