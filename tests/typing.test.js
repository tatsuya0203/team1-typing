"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { romanize, QUESTIONS, setupGame, normalizeInput, readingTokens } = require("../kadai6.js");
const expected = [
  "sarumokikaraotiru", "gomennnasaiha,eigodesorrydesu", "isogabamaware",
  "innsutano@hamennsyonnnitukawarerumonodesu", "tomodatinotannzyoubiha9/15desu",
  "sekainihitotudakenohana", "uewomuitearukou", "lemon", "yorunikakeru", "doraihurawa-",
];
test("全10問が独立した訓令式ベースの期待値に一致する", () => {
  assert.deepEqual(QUESTIONS.map(q => q.roma), expected);
});
test("ん・拗音・促音・長音・カタカナの入力規則", () => {
  assert.equal(romanize("んあんなんにんん"), "nnannnannninnnn");
  assert.equal(romanize("しちつふじしゃちょじょう"), "sitituhuzisyatyozyou");
  assert.equal(romanize("きってがっこうマッチ"), "kittegakkoumatti");
  assert.equal(romanize("ドライフラワー"), "doraihurawa-");
  assert.throws(() => romanize("漢字"), /未対応/);
});
function harness() {
  const elements = new Map();
  let focused;
  const el = id => {
    if (!elements.has(id)) elements.set(id, { value: "", textContent: "", hidden: false, inert: false, dataset: {}, listeners: {},
      addEventListener(type, fn) { this.listeners[type] = fn; }, focus() { focused = id; },
    });
    return elements.get(id);
  };
  const handlers = {}, timers = new Map();
  let nextId = 0;
  const document = { getElementById: el, body: { dataset: {} }, hidden: false,
    addEventListener(type, fn) { handlers[type] = fn; } };
  setupGame(document, { setTimeout(fn) { timers.set(++nextId, fn); return nextId; }, clearTimeout(id) { timers.delete(id); } });
  const fire = (id, type = "click", event = {}) => el(id).listeners[type]({ preventDefault() {}, ...event });
  const key = (key, options = {}) => {
    let prevented = false;
    handlers.keydown({ key, preventDefault() { prevented = true; }, ...options });
    return prevented;
  };
  const tick = () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); };
  const start = () => { fire(document.body.dataset.phase === "finished" ? "retrybtn" : "startbtn"); tick(); tick(); tick(); };
  return { el, fire, key, tick, start, focus: () => focused, document, handlers, timers };
}
test("入力欄のフォーカスなしでページ全体から正しく採点する", () => {
  const h = harness(); h.key("x"); h.start();
  assert.equal(h.focus(), "ime-input");
  h.key("x", { target: { closest() { return null; } } }); h.key("s");
  assert.equal(h.el("incorrect").textContent, "1 回"); assert.equal(h.el("correct").textContent, "1 文字");
  assert.equal(h.el("car").textContent, "50%"); assert.equal(h.el("nextchar").textContent, "a");
});
test("開始画面・練習画面・結果画面を切り替えて全問完了後に再挑戦できる", () => {
  const h = harness();
  assert.equal(h.el("welcome-screen").hidden, false); assert.equal(h.el("play-screen").hidden, true);
  h.start(); assert.equal(h.el("welcome-screen").hidden, true); assert.equal(h.el("result-screen").hidden, true);
  expected.join("").split("").forEach(c => h.key(c));
  assert.equal(h.el("progress").value, 10); assert.equal(h.el("remaining-dishes").textContent, "00"); assert.equal(h.el("car").textContent, "100%");
  assert.equal(h.el("correct").textContent, `${expected.join("").length} 文字`);
  assert.equal(h.el("play-screen").hidden, true); assert.equal(h.el("result-screen").hidden, false);
  assert.equal(h.focus(), "retrybtn"); h.key("x"); assert.equal(h.el("incorrect").textContent, "0 回");
  h.start(); assert.equal(h.el("nextchar").textContent + h.el("roma").textContent, expected[0]); assert.equal(h.el("remaining-dishes").textContent, "10");
  assert.equal(h.el("correct").textContent, "0 文字"); assert.equal(h.focus(), "ime-input");
});
test("IME・修飾キー・ショートカット・長押しは採点しない", () => {
  const h = harness(); h.start();
  ["Shift", "Backspace", "ArrowRight", "Tab"].forEach(key => assert.equal(h.key(key), false));
  h.key("a", { isComposing: true }); h.key("a", { ctrlKey: true }); h.key("a", { metaKey: true });
  h.key("a", { altKey: true }); h.key("漢"); h.key("s", { repeat: true });
  assert.equal(h.el("incorrect").textContent, "0 回"); assert.equal(h.el("correct").textContent, "0 文字");
});
test("ボタンや編集可能領域のキーは採点せずSpace/Enter操作を維持する", () => {
  const h = harness(); h.start();
  const target = { closest() { return {}; } };
  assert.equal(h.key(" ", { target }), false); assert.equal(h.key("Enter", { target }), false);
  assert.equal(h.key("s", { target }), false); assert.equal(h.el("correct").textContent, "0 文字");
  assert.equal(h.el("incorrect").textContent, "0 回");
});
test("Escで中断・再開して位置と成績を保持する", () => {
  const h = harness(); h.start(); h.key("s"); h.key("Escape");
  assert.equal(h.document.body.dataset.phase, "paused"); assert.equal(h.el("game").inert, true);
  assert.equal(h.focus(), "resumebtn"); h.key("a"); assert.equal(h.el("correct").textContent, "1 文字");
  h.key("Escape"); assert.equal(h.document.body.dataset.phase, "playing"); assert.equal(h.el("game").inert, false);
  assert.equal(h.focus(), "ime-input"); h.key("a"); assert.equal(h.el("correct").textContent, "2 文字");
});
test("カウントダウン中の中断・復帰・終了はタイマーを残さない", () => {
  const h = harness(); h.fire("startbtn"); h.tick(); h.fire("pausebtn");
  assert.equal(h.timers.size, 0); h.tick(); assert.equal(h.document.body.dataset.phase, "paused");
  h.fire("resumebtn"); h.tick(); h.tick(); h.tick(); assert.equal(h.document.body.dataset.phase, "playing");
  h.fire("pausebtn"); h.fire("quitbtn"); assert.equal(h.document.body.dataset.phase, "idle");
  assert.equal(h.el("correct").textContent, "0 文字"); assert.equal(h.focus(), "startbtn");
  h.fire("startbtn"); h.fire("pausebtn"); h.fire("quitbtn"); h.tick();
  assert.equal(h.document.body.dataset.phase, "idle"); assert.equal(h.timers.size, 0);
});
test("別タブへ移動すると自動停止し、勝手に再開しない", () => {
  const h = harness(); h.start(); h.document.hidden = true; h.handlers.visibilitychange();
  assert.equal(h.document.body.dataset.phase, "paused");
  h.document.hidden = false; h.handlers.visibilitychange(); assert.equal(h.document.body.dataset.phase, "paused");
  h.fire("resumebtn"); h.key("s"); assert.equal(h.el("correct").textContent, "1 文字");
});
function compose(h, text, trailingInput = true) {
  h.fire("ime-input", "compositionstart");
  h.el("ime-input").value = text;
  h.fire("ime-input", "input", { isComposing: true });
  h.fire("ime-input", "compositionend", { data: text });
  if (trailingInput) {
    h.el("ime-input").value = text;
    h.fire("ime-input", "input", { inputType: "insertCompositionText" });
  }
}
function reachQuestion(h, index) {
  for (let q = 0; q < index; q++) for (const c of expected[q]) h.key(c);
}
test("全問題のかなトークンとローマ字位置が一致する", () => {
  QUESTIONS.forEach(q => {
    const tokens = readingTokens(q.reading);
    assert.equal(tokens.map(t => t.roma).join(""), q.roma);
    tokens.forEach(t => assert.equal(q.roma.slice(t.start, t.end), t.roma));
  });
  assert.equal(normalizeInput("ＡＢＣ１２３＠、カタカナ"), "abc123@,かたかな");
  assert.deepEqual(readingTokens("きって").map(t => t.roma), ["ki", "t", "te"]);
});
test("IME開始前keydown・未確定input・確定後inputを二重採点しない", () => {
  const h = harness(); h.start();
  assert.equal(h.key("s", { keyCode: 229, target: h.el("ime-input") }), false);
  h.fire("ime-input", "compositionstart"); h.el("ime-input").value = "さ";
  h.key("a", { isComposing: true }); h.fire("ime-input", "input", { isComposing: true });
  assert.equal(h.el("correct").textContent, "0 文字");
  h.fire("ime-input", "compositionend", { data: "さ" });
  assert.equal(h.el("correct").textContent, "2 文字");
  h.el("ime-input").value = "さ"; h.fire("ime-input", "input", { inputType: "insertText" });
  assert.equal(h.el("correct").textContent, "2 文字"); assert.equal(h.el("incorrect").textContent, "0 回");
  compose(h, "る"); assert.equal(h.el("correct").textContent, "4 文字");
});
test("全10問をかな・カタカナのIME確定で完了する（ん・拗音・長音を含む）", () => {
  const h = harness(); h.start();
  QUESTIONS.forEach(q => compose(h, q.reading));
  assert.equal(h.document.body.dataset.phase, "finished");
  assert.equal(h.el("correct").textContent, `${expected.join("").length} 文字`);
  assert.equal(h.el("incorrect").textContent, "0 回");
});
test("全角英数inputとローマ字keydownを混ぜても二重入力にならない", () => {
  const h = harness(); h.start();
  h.el("ime-input").value = "ＳＡ"; h.fire("ime-input", "input");
  h.key("r", { target: h.el("ime-input") }); h.fire("ime-input", "input");
  compose(h, "るも");
  assert.equal(h.el("altype").textContent, "sarumo");
  assert.equal(h.el("correct").textContent, "6 文字"); assert.equal(h.el("incorrect").textContent, "0 回");
});
test("拗音を二回に分けて確定し、中断後も続けられる", () => {
  const h = harness(); h.start(); reachQuestion(h, 3);
  for (const c of "innsutano@hamenn") h.key(c);
  const previous = h.el("correct").textContent;
  compose(h, "し"); assert.equal(h.el("correct").textContent, previous);
  h.fire("pausebtn"); h.fire("resumebtn"); compose(h, "ょんに");
  assert.equal(h.el("altype").textContent, "innsutano@hamennsyonnni");
  assert.equal(h.el("incorrect").textContent, "0 回");
});
test("んのローマ字途中からかなに切り替えて残りだけ進める", () => {
  const h = harness(); h.start(); reachQuestion(h, 1);
  for (const c of "gomen") h.key(c);
  compose(h, "んなさい");
  assert.equal(h.el("altype").textContent, "gomennnasai"); assert.equal(h.el("incorrect").textContent, "0 回");
});
test("漢字確定は無採点、かなの誤りは一回だけ採点し修正を続けられる", () => {
  const h = harness(); h.start(); compose(h, "猿");
  assert.equal(h.el("correct").textContent, "0 文字"); assert.equal(h.el("incorrect").textContent, "0 回");
  assert.match(h.el("feedback").textContent, /漢字に変換せず/);
  compose(h, "た"); assert.equal(h.el("incorrect").textContent, "1 回");
  compose(h, "さる"); assert.equal(h.el("correct").textContent, "4 文字");
});
test("変換取消・中断中の確定・画面クリックのフォーカス復帰", () => {
  const h = harness(); h.start(); h.fire("ime-input", "compositionstart");
  assert.equal(h.key("Escape", { isComposing: true }), false);
  h.fire("ime-input", "compositionend", { data: "" }); assert.equal(h.el("incorrect").textContent, "0 回");
  h.fire("ime-input", "compositionstart"); h.el("ime-input").value = "さ"; h.fire("pausebtn");
  h.fire("ime-input", "compositionend", { data: "さ" }); assert.equal(h.el("correct").textContent, "0 文字");
  h.fire("resumebtn"); h.fire("game"); assert.equal(h.focus(), "ime-input");
  compose(h, "さ"); assert.equal(h.el("correct").textContent, "2 文字");
});
test("編集ターゲットでの長押しや通常Enterが余分なinputを発生させない", () => {
  const h = harness(); h.start();
  assert.equal(h.key("s", { repeat: true, target: h.el("ime-input") }), true);
  assert.equal(h.key("Enter", { target: h.el("ime-input") }), true);
  assert.equal(h.el("correct").textContent, "0 文字"); assert.equal(h.el("incorrect").textContent, "0 回");
});
