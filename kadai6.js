"use strict";

// 訓令式を基にした、この練習専用の入力表記。
// 撥音は常に nn、長音は読みの母音を残す（ーは -）。助詞も読み欄どおり。
const KANA = Object.freeze({
  あ: "a", い: "i", う: "u", え: "e", お: "o",
  か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
  さ: "sa", し: "si", す: "su", せ: "se", そ: "so",
  た: "ta", ち: "ti", つ: "tu", て: "te", と: "to",
  な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
  は: "ha", ひ: "hi", ふ: "hu", へ: "he", ほ: "ho",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
  や: "ya", ゆ: "yu", よ: "yo",
  ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
  わ: "wa", を: "wo", ん: "nn",
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
  ざ: "za", じ: "zi", ず: "zu", ぜ: "ze", ぞ: "zo",
  だ: "da", ぢ: "zi", づ: "zu", で: "de", ど: "do",
  ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
  ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
  きゃ: "kya", きゅ: "kyu", きょ: "kyo",
  しゃ: "sya", しゅ: "syu", しょ: "syo",
  ちゃ: "tya", ちゅ: "tyu", ちょ: "tyo",
  にゃ: "nya", にゅ: "nyu", にょ: "nyo",
  ひゃ: "hya", ひゅ: "hyu", ひょ: "hyo",
  みゃ: "mya", みゅ: "myu", みょ: "myo",
  りゃ: "rya", りゅ: "ryu", りょ: "ryo",
  ぎゃ: "gya", ぎゅ: "gyu", ぎょ: "gyo",
  じゃ: "zya", じゅ: "zyu", じょ: "zyo",
  びゃ: "bya", びゅ: "byu", びょ: "byo",
  ぴゃ: "pya", ぴゅ: "pyu", ぴょ: "pyo",
  "ー": "-", "、": ",", "＠": "@",
});

function romanize(reading) {
  const kana = reading.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  let result = "";
  for (let i = 0; i < kana.length; i++) {
    if (kana[i] === "っ") {
      const next = KANA[kana.slice(i + 1, i + 3)] || KANA[kana[i + 1]];
      if (!next || !/^[ksthpbgzdrm]/.test(next)) throw new Error("未対応の促音: " + reading);
      result += next[0];
      continue;
    }
    const pair = KANA[kana.slice(i, i + 2)];
    if (pair) { result += pair; i++; }
    else if (KANA[kana[i]]) result += KANA[kana[i]];
    else if (/[a-z0-9/@,\-]/.test(kana[i])) result += kana[i];
    else throw new Error("未対応の読み: " + kana[i]);
  }
  return result;
}

const QUESTIONS = Object.freeze([
  { text: "猿も木から落ちる", reading: "さるもきからおちる" },
  { text: "ごめんなさいは、英語でsorryです", reading: "ごめんなさいは、えいごでsorryです" },
  { text: "急がば回れ", reading: "いそがばまわれ" },
  { text: "インスタの＠はメンションに使われるものです", reading: "インスタの＠はメンションにつかわれるものです" },
  { text: "友達の誕生日は9/15です", reading: "ともだちのたんじょうびは9/15です" },
  { text: "世界に一つだけの花", reading: "せかいにひとつだけのはな" },
  { text: "上を向いて歩こう", reading: "うえをむいてあるこう" },
  { text: "Lemon", reading: "lemon" },
  { text: "夜に駆ける", reading: "よるにかける" },
  { text: "ドライフラワー", reading: "ドライフラワー" },
].map(question => Object.freeze({ ...question, roma: romanize(question.reading) })));

// Track each mora and its romanized span, including っ and always-nn ん.
function normalizeInput(value) {
  return value.normalize("NFKC").toLowerCase()
    .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/、/g, ",");
}
function readingTokens(reading) {
  const kana = normalizeInput(reading), tokens = [];
  let offset = 0;
  for (let i = 0; i < kana.length; i++) {
    let source = kana[i], roma;
    if (KANA[kana.slice(i, i + 2)]) { source = kana.slice(i, i + 2); i++; }
    if (source === "っ") {
      const following = KANA[kana.slice(i + 1, i + 3)] || KANA[kana[i + 1]];
      if (!following) throw new Error("未対応の促音");
      roma = following[0];
    } else roma = KANA[source] || source;
    tokens.push({ source, roma, start: offset, end: offset + roma.length });
    offset += roma.length;
  }
  return tokens;
}
const QUESTION_TOKENS = QUESTIONS.map(question => readingTokens(question.reading));

function setupGame(document, timer = globalThis) {
  const el = id => document.getElementById(id);
  const input = el("ime-input");
  let phase = "idle", previousPhase = "playing", questionIndex = 0, position = 0;
  let correct = 0, incorrect = 0, timeout = null, pendingKana = "";
  let composing = false, compositionCancelled = false, compositionEcho = null;

  function resetInput(clearPending = true) {
    compositionCancelled = composing;
    composing = false; compositionEcho = null; if (clearPending) pendingKana = ""; input.value = "";
  }
  function focusInput() { input.focus({ preventScroll: true }); }
  function setPhase(next) {
    phase = next;
    document.body.dataset.phase = next;
    el("welcome-screen").hidden = next !== "idle";
    el("play-screen").hidden = next === "idle" || next === "finished";
    el("result-screen").hidden = next !== "finished";
    el("pause-panel").hidden = next !== "paused";
    el("game").inert = next === "paused";
    el("pausebtn").inert = next === "paused";
    input.disabled = next !== "playing";
  }
  function results() {
    el("correct").textContent = `${correct} 文字`;
    el("incorrect").textContent = `${incorrect} 回`;
    el("car").textContent = correct + incorrect ? `${Math.floor(correct / (correct + incorrect) * 100)}%` : "—";
  }
  function showQuestion() {
    const question = QUESTIONS[questionIndex];
    el("bunsyou").textContent = question.text;
    el("reading").textContent = question.reading;
    el("altype").textContent = question.roma.slice(0, position);
    el("nextchar").textContent = question.roma[position] || "";
    el("roma").textContent = question.roma.slice(position + 1);
    el("progress-text").textContent = `${questionIndex + 1} 皿目 / 全 ${QUESTIONS.length} 皿`;
    el("dish-count").textContent = `${questionIndex} 皿`;
    el("remaining-dishes").textContent = String(QUESTIONS.length - questionIndex).padStart(2, "0");
    el("dish-emblem").dataset.fish = ["salmon", "tuna", "egg"][questionIndex % 3];
  }
  function clearRound() {
    timer.clearTimeout(timeout); resetInput();
    questionIndex = 0; position = 0; correct = 0; incorrect = 0;
    ["reading", "altype", "nextchar", "roma", "feedback", "finishtext"].forEach(id => el(id).textContent = "");
    el("progress").value = 0; el("dish-count").textContent = "0 皿";
    el("remaining-dishes").textContent = String(QUESTIONS.length);
    el("progress-text").textContent = `1 皿目 / 全 ${QUESTIONS.length} 皿`;
    results();
  }
  function home() { clearRound(); setPhase("idle"); el("startbtn").focus(); }
  function countdown() {
    setPhase("countdown"); el("game").focus();
    el("bunsyou").textContent = "いらっしゃいませ！";
    el("reading").textContent = "日本語入力のままでもOK。かなで確定して進めます。";
    let remaining = 3;
    function tick() {
      if (remaining === 0) {
        setPhase("playing"); el("count").textContent = "営業中";
        showQuestion(); focusInput(); return;
      }
      el("count").textContent = `${remaining} 秒後にスタート`;
      el("nextchar").textContent = String(remaining);
      remaining--; timeout = timer.setTimeout(tick, 1000);
    }
    tick();
  }
  function start() {
    if (phase !== "idle" && phase !== "finished") return;
    clearRound(); countdown();
  }
  function pause() {
    if (phase !== "playing" && phase !== "countdown") return;
    previousPhase = phase; timer.clearTimeout(timeout);
    setPhase("paused"); resetInput(false); el("resumebtn").focus();
  }
  function resume() {
    if (phase !== "paused") return;
    if (previousPhase === "countdown") countdown();
    else { setPhase("playing"); focusInput(); }
  }
  function advance(length) {
    correct += length; position += length; el("feedback").textContent = "";
    results(); showQuestion();
    if (position === QUESTIONS[questionIndex].roma.length) {
      questionIndex++; position = 0; pendingKana = ""; el("progress").value = questionIndex;
      el("dish-count").textContent = `${questionIndex} 皿`;
      el("remaining-dishes").textContent = String(QUESTIONS.length - questionIndex).padStart(2, "0");
      if (questionIndex === QUESTIONS.length) {
        setPhase("finished"); resetInput();
        el("finishtext").textContent = `全10問を打ち終えました。今回の正答率は ${el("car").textContent} です。`;
        el("retrybtn").focus();
      } else showQuestion();
    }
  }
  function miss() {
    incorrect++;
    const token = QUESTION_TOKENS[questionIndex].find(item => position < item.end);
    el("feedback").textContent = `次は「${QUESTIONS[questionIndex].roma[position]}」、かななら「${token.source.slice(pendingKana.length)}」。そのまま続けてください。`;
    results();
  }
  function commit(text) {
    if (phase !== "playing" || !text) return;
    const normalized = normalizeInput(text);
    // Unsupported kanji/conversions never silently advance or incur a mistake.
    if (/[^\x20-\x7eぁ-ゖー]/.test(normalized)) {
      el("feedback").textContent = "漢字に変換せず、ひらがな・カタカナで確定してください（今回は採点しません）。";
      return;
    }
    const initialQuestion = questionIndex;
    for (const character of normalized) {
      if (phase !== "playing" || questionIndex !== initialQuestion) break;
      if (/[\x20-\x7e]/.test(character)) {
        pendingKana = "";
        if (character === QUESTIONS[questionIndex].roma[position]) advance(1);
        else miss();
      } else {
        const token = QUESTION_TOKENS[questionIndex].find(item => position < item.end);
        if (token.source[pendingKana.length] !== character) { miss(); continue; }
        pendingKana += character;
        if (pendingKana === token.source) {
          pendingKana = ""; advance(token.end - position);
        } else {
          el("feedback").textContent = `「${pendingKana}」を受け付けました。続けて「${token.source.slice(pendingKana.length)}」を入力してください。`;
        }
      }
    }
  }
  document.addEventListener("keydown", event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.repeat && !composing && !event.isComposing) {
      if (event.target === input) event.preventDefault();
      return;
    }
    if (event.isComposing || composing || event.keyCode === 229 || event.key === "Process") return;
    compositionEcho = null;
    if (event.key === "Escape") {
      if (phase === "playing" || phase === "countdown") { event.preventDefault(); pause(); }
      else if (phase === "paused") { event.preventDefault(); resume(); }
      return;
    }
    if (phase === "playing" && event.target === input && event.key === "Enter") { event.preventDefault(); return; }
    if (phase !== "playing" || event.key.length !== 1) return;
    if (event.target !== input && event.target?.closest?.("button, a, input, textarea, select, summary, [contenteditable]")) return;
    // With IME off, keydown owns the character and cancels its duplicate input event.
    // IME-owned keys are left to composition/input instead.
    event.preventDefault(); commit(event.key);
  });
  input.addEventListener("compositionstart", () => {
    composing = true; compositionCancelled = phase !== "playing"; compositionEcho = null;
    if (phase === "playing") el("feedback").textContent = "かなのまま Enter で確定すると進みます。";
  });
  input.addEventListener("compositionend", event => {
    const text = event.data ?? input.value;
    composing = false;
    if (!compositionCancelled && phase === "playing") commit(text);
    compositionCancelled = false;
    compositionEcho = text; input.value = "";
  });
  input.addEventListener("input", event => {
    if (composing || event.isComposing) return;
    const text = input.value;
    input.value = "";
    if (compositionEcho !== null && (text === compositionEcho || text === "")) {
      compositionEcho = null; return;
    }
    compositionEcho = null; commit(text);
  });
  input.addEventListener("paste", event => {
    event.preventDefault(); el("feedback").textContent = "貼り付けず、キーボードで入力してください。";
  });
  input.addEventListener("drop", event => event.preventDefault());
  // Clicking the question restores the IME target without hijacking buttons or Tab.
  el("game").addEventListener("click", () => { if (phase === "playing") focusInput(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
  el("startbtn").addEventListener("click", start);
  el("retrybtn").addEventListener("click", start);
  el("pausebtn").addEventListener("click", pause);
  el("resumebtn").addEventListener("click", resume);
  el("quitbtn").addEventListener("click", home);
  el("homebtn").addEventListener("click", home);
  setPhase("idle");
}

if (typeof document !== "undefined") setupGame(document);
if (typeof module !== "undefined") module.exports = { romanize, QUESTIONS, setupGame, normalizeInput, readingTokens };
