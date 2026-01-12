// CoCo壱クイズ app.js
// - manifest.json からクイズ一覧を読み込み
// - クイズJSON（title, questions[{q, choices[], answer}]）を読み込み表示
// - window.QUIZ_CONFIG.shuffleChoices === true のとき、choices を表示時にシャッフル（answer追従）

(() => {
  const $ = (sel, root=document) => root.querySelector(sel);

  const splash = $("#splash");
  const main = $("#main");
  const segmentsEl = $("#segments");
  const quizListEl = $("#quizList");

  const CONFIG = Object.assign({ shuffleChoices: false }, (window.QUIZ_CONFIG || {}));

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  function el(tag, attrs={}, ...children){
    const node = document.createElement(tag);
    for(const [k,v] of Object.entries(attrs || {})){
      if(k === "class") node.className = v;
      else if(k === "dataset"){
        for(const [dk, dv] of Object.entries(v || {})) node.dataset[dk] = dv;
      } else if(k === "text") node.textContent = v;
      else if(k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for(const c of children){
      if(c == null) continue;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  }

  function shuffleWithAnswer(choices, answerIndex){
    const arr = choices.map((text, i) => ({ text, i }));
    for(let i = arr.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const newAnswer = arr.findIndex(x => x.i === answerIndex);
    return { choices: arr.map(x => x.text), answer: newAnswer };
  }

  function uniq(arr){
    return Array.from(new Set(arr));
  }

  function normalizeCategory(c){
    return (c || "未分類").trim();
  }

  function showError(title, message){
    quizListEl.innerHTML = "";
    quizListEl.appendChild(
      el("div", { class:"choice", style:"cursor:default" },
        el("div", { style:"font-weight:800; margin-bottom:6px" }, title),
        el("div", { style:"opacity:.85" }, message)
      )
    );
  }

  async function loadManifest(){
    const r = await fetch("./manifest.json", { cache: "no-store" });
    if(!r.ok) throw new Error("manifest.json の読み込みに失敗しました (" + r.status + ")");
    return r.json();
  }

  function renderSegments(categories, active){
    segmentsEl.innerHTML = "";
    categories.forEach(cat => {
      const btn = el("button", {
        type:"button",
        class: "segment" + (cat === active ? " active" : ""),
        role: "tab",
        "aria-selected": String(cat === active),
        onclick: () => {
          state.activeCategory = cat;
          renderAll();
        }
      }, cat);
      segmentsEl.appendChild(btn);
    });
  }

  function formatUpdated(u){
    if(!u) return "";
    return String(u);
  }

  function renderQuizList(items){
    quizListEl.innerHTML = "";
    items.forEach(qz => {
      const title = qz.title || qz.id || "無題";
      const cat = normalizeCategory(qz.category);
      const updated = formatUpdated(qz.updated);

      const btn = el("button", {
        type:"button",
        class:"choice",
        onclick: () => openQuiz(qz)
      },
        el("div", { style:"font-weight:800" }, title),
        el("div", { style:"opacity:.75; font-size:.92em; margin-top:4px" },
          [cat, updated].filter(Boolean).join(" / ")
        )
      );
      quizListEl.appendChild(btn);
    });

    if(items.length === 0){
      quizListEl.appendChild(
        el("div", { class:"choice", style:"cursor:default; opacity:.85" }, "該当するクイズがありません")
      );
    }
  }

  function renderAll(){
    const allCats = ["すべて", ...uniq(state.quizzes.map(q => normalizeCategory(q.category)))];
    renderSegments(allCats, state.activeCategory);

    const filtered = (state.activeCategory === "すべて")
      ? state.quizzes
      : state.quizzes.filter(q => normalizeCategory(q.category) === state.activeCategory);

    renderQuizList(filtered);
  }

  function mountQuizView(container, quizData, metaTitle){
    container.innerHTML = "";

    let score = 0;
    const total = (quizData.questions || []).length;

    const header = el("div", { class:"header-row", style:"align-items:center" },
      el("div", {},
        el("h1", { style:"margin:0" }, quizData.title || metaTitle || "クイズ"),
        el("div", { class:"muted", style:"margin-top:6px" },
          `Score: `,
          el("span", { id:"score", style:"font-weight:800" }, "0"),
          ` / ${total}`
        )
      ),
      el("div", { style:"display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end" },
        el("button", { type:"button", class:"segment", onclick: () => {
          // 戻る
          state.mode = "list";
          renderAll();
          mountListView();
        }}, "← 一覧へ"),
        el("button", { type:"button", class:"segment", onclick: () => {
          // リトライ（同じデータで再描画。シャッフルがONなら並びも変わる）
          mountQuizView(container, quizData, metaTitle);
        }}, "↻ もう一回")
      )
    );

    const body = el("div", { style:"margin-top:14px" });

    function updateScore(){
      const s = $("#score", container);
      if(s) s.textContent = String(score);
    }

    (quizData.questions || []).forEach((raw, idx) => {
      // 表示時だけシャッフル（answer追従）
      let item = raw;
      if(CONFIG.shuffleChoices){
        const sh = shuffleWithAnswer(raw.choices || [], raw.answer);
        item = Object.assign({}, raw, { choices: sh.choices, answer: sh.answer });
      }

      const answered = { done:false };
      const result = el("div", { class:"muted", style:"margin-top:10px; font-weight:800" });

      const card = el("section", { class:"card", style:"margin-top:14px" },
        el("div", { style:"font-weight:900; margin-bottom:10px" }, `Q${idx+1}. ${item.q}`),
        el("div", { class:"choices" },
          ...(item.choices || []).map((text, i) => el("button", {
            type:"button",
            class:"choice",
            onclick: () => {
              if(answered.done) return;
              answered.done = true;

              const correct = (i === item.answer);
              if(correct){
                score++;
                result.textContent = "⭕ 正解！";
                result.style.color = "#0a7";
              } else {
                result.textContent = `❌ 不正解（正解：${item.choices[item.answer]}）`;
                result.style.color = "#c33";
              }
              updateScore();

              // 選択後は他ボタンを無効化
              const btns = card.querySelectorAll("button.choice");
              btns.forEach(b => b.disabled = true);
            }
          }, `${["A","B","C","D"][i] || (i+1)}. ${text}`))
        ),
        result
      );

      body.appendChild(card);
    });

    container.appendChild(header);
    container.appendChild(body);

    // 完了カード
    const doneCard = el("section", { class:"card", style:"margin-top:14px" },
      el("div", { style:"font-weight:900; margin-bottom:8px" }, "終了"),
      el("div", { class:"muted" }, "全問回答するとスコアが確定します。必要なら「↻ もう一回」で再挑戦。")
    );
    container.appendChild(doneCard);
  }

  async function openQuiz(meta){
    try{
      const url = meta.file || meta.json || meta.path || (meta.id ? `./${meta.id}.json` : null);
      const jsonUrl = url || "./passport.json"; // フォールバック
      const r = await fetch(jsonUrl, { cache:"no-store" });
      if(!r.ok) throw new Error("クイズJSONの読み込みに失敗しました (" + r.status + ") : " + jsonUrl);
      const data = await r.json();

      state.mode = "quiz";

      // 画面をクイズ表示に切替
      const wrap = $("#main");
      wrap.innerHTML = "";
      const container = el("div", { class:"wrap" },
        el("section", { class:"card" }, el("div", { id:"quizMount" }))
      );
      wrap.appendChild(container);

      mountQuizView($("#quizMount"), data, meta.title);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch(err){
      alert(String(err));
      console.error(err);
    }
  }

  function mountListView(){
    // 元のレイアウトに戻す（index.html準拠）
    const wrap = $("#main");
    wrap.innerHTML = `
      <section class="card">
        <div class="header-row">
          <h1>クイズを選択</h1>
          <div id="segments" class="segments" role="tablist" aria-label="ジャンル"></div>
        </div>
        <div id="quizList" class="choices"></div>
      </section>
    `;
  }

  const state = {
    quizzes: [],
    activeCategory: "すべて",
    mode: "list"
  };

  async function init(){
    try{
      // splash fade
      await sleep(250);
      if(splash){
        splash.style.transition = "opacity .35s ease";
        splash.style.opacity = "0";
      }
      if(main){
        main.style.transition = "opacity .35s ease";
        main.style.opacity = "1";
      }

      const manifest = await loadManifest();

      // 互換：manifest.quizzes がなければ配列直置きも受ける
      const quizzes = Array.isArray(manifest.quizzes) ? manifest.quizzes : (Array.isArray(manifest) ? manifest : []);
      state.quizzes = quizzes.map(q => Object.assign({}, q, { category: normalizeCategory(q.category) }));

      // DOM取り直し（indexの内容を前提）
      // ※ mountListViewは init開始時点では不要（indexにすでにあるため）
      renderAll();
    } catch(err){
      console.error(err);
      showError("読み込みエラー", String(err));
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
