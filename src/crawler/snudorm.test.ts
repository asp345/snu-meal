import assert from "node:assert/strict";
import test from "node:test";
import { buildSnudormPayloads } from "./snudorm.js";

test("SNUDORM README sample preserves service times and pending breakfast price", () => {
  const html = `
    <main>
      <h2>아워홈(901동)</h2>
      <p>세미양식부페 : 5,000원</p>
      <p>단호박스프/조랭이떡국,치킨너겟,삶은계란*소금,토스트,씨리얼, 흰우유/두유,그린샐러드</p>
      <p>※운영시간 : 08:00~09:30</p>
      <p>목살김치찌개&amp;수제깻잎어묵전 : 6,000원</p>
      <p>치즈오븐스파게티*마늘빵 : 6,000원</p>
      <p>(잇템)순살햄후라이 : 2,000원</p>
      <p>※운영시간 : 11:30~13:30</p>
      <p>새우볶음밥*짜장소스&amp;제육땅콩강정 : 6,000원</p>
      <p>(잇템)소떡소떡 : 2,000원</p>
      <p>※운영시간 : 17:30~19:30</p>
      <h2>생협기숙사(919동)</h2>
      <p>냉모밀&amp;미니알밥&amp;새우튀김(#) : 6,000원</p>
      <p>※ 운영시간 : 11:30~13:30</p>
      <p>오리주물럭 : 6,500원</p>
      <p>※ 운영시간 : 17:30~19:00</p>
    </main>
    <footer>개인정보처리방침</footer>
  `;
  const payloads = buildSnudormPayloads(html, "2026-05-15");
  const breakfast = payloads.find(({ restaurant, type }) => restaurant === "아워홈" && type === "BR");
  assert.equal(breakfast?.meals.length, 1);
  assert.equal(breakfast?.meals[0].price, 5000);
  assert.ok(breakfast?.meals[0].menus.includes("토스트"));

  const lunch = payloads.find(({ restaurant, type }) => restaurant === "아워홈" && type === "LU");
  assert.equal(lunch?.meals.length, 3);
  assert.deepEqual(lunch?.meals[2].menus, ["순살햄후라이"]);

  const dinner = payloads.find(({ restaurant, type }) => restaurant === "아워홈" && type === "DN");
  assert.deepEqual(dinner?.meals[0].menus, ["새우볶음밥", "짜장소스", "제육땅콩강정"]);

  const coopLunch = payloads.find(({ restaurant, type }) => restaurant === "생협기숙사" && type === "LU");
  assert.deepEqual(coopLunch?.meals[0], {
    price: 6000,
    no_meat: true,
    menus: ["냉모밀", "미니알밥", "새우튀김"],
  });
});
