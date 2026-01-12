// Quiz app.js (v10) - choices shuffle + PDF button
(() => {
  const $ = (sel, root=document) => root.querySelector(sel);

  const CONFIG = Object.assign({ shuffleChoices: true }, (window.QUIZ_CONFIG || {}));

  function el(tag, attrs={}, ...children){
    const node = document.createElement(tag);
    for(const [k,v] of Object.entries(attrs || {})){
      if(k === "class") node.className = v;
      else if(k === "text") node.textContent = v;
      else if(k === "html") node.innerHTML = v;
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
    const arr = (choices || []).map((text, i) => ({ text, i }));
    for(let i = arr.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const newAnswer = arr.findIndex(x => x.i === answerIndex);
    return { choices: arr.map(x => x.text), answer: newAnswer };
  }

  function normalizeCategory(c){
    return (c || "未分類").trim();
  }

  async function fetchJson(url){
    const r = await fetch(url, { cache: "no-store" });
    if(!r.ok) throw new Error(`${url} の読み込みに失敗しました (${r.status})`);
    return r.json();
  }

  function mountListSkeleton(){
    const main = $("#main");
    if(!main) return;
    // index.html側と同じIDを前提
    if(!$("#quizList")){
      main.innerHTML = `
        <section class="card">
          <div class="header-row">
            <h1>クイズを選択</h1>
            <div id="segments" class="segments" role="tablist" aria-label="ジャンル"></div>
          </div>
          <div id="quizList" class="choices"></div>
        </section>
      `;
    }
  }

  function renderSegments(cats, active){
    const segments = $("#segments");
    if(!segments) return;
    segments.innerHTML = "";
    cats.forEach(cat => {
      const b = el("button", {
        type:"button",
        class: "segment" + (cat === active ? " active" : ""),
        onclick: () => { state.activeCategory = cat; renderList(); }
      }, cat);
      segments.appendChild(b);
    });
  }

  function renderList(){
    const list = $("#quizList");
    if(!list) return;
    const cats = ["すべて", ...Array.from(new Set(state.quizzes.map(q => normalizeCategory(q.category))))];
    renderSegments(cats, state.activeCategory);

    const items = (state.activeCategory === "すべて")
      ? state.quizzes
      : state.quizzes.filter(q => normalizeCategory(q.category) === state.activeCategory);

    list.innerHTML = "";

    if(items.length === 0){
      list.appendChild(el("div", { class:"choice", style:"cursor:default; opacity:.85" }, "該当するクイズがありません"));
      return;
    }

    items.forEach(meta => {
      const title = meta.title || meta.id || "無題";
      const cat = normalizeCategory(meta.category);
      const updated = meta.updated ? String(meta.updated) : "";
      const sub = [cat, updated].filter(Boolean).join(" / ");

      // 外枠（カード）
      const card = el("div", {
        class: "choice",
        role: "button",
        tabindex: "0",
        style: "display:flex; align-items:center; justify-content:space-between; gap:12px; text-align:left;",
        onclick: (e) => {
          // 内部ボタンのクリックは無視
          if(e.target && e.target.closest && e.target.closest(".mini-btn")) return;
          openQuiz(meta);
        },
        onkeydown: (e) => {
          if(e.key === "Enter" || e.key === " ") openQuiz(meta);
        }
      });

      const left = el("div", {},
        el("div", { style:"font-weight:800" }, title),
        el("div", { style:"opacity:.75; font-size:.92em; margin-top:4px" }, sub)
      );

      const right = el("div", { style:"display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end" });

      // 開始ボタン
      right.appendChild(el("button", {
        type:"button",
        class:"mini-btn",
        style:"padding:8px 10px; border-radius:10px; border:1px solid rgba(255,255,255,.25); background:rgba(255,255,255,.08); color:inherit; cursor:pointer;",
        onclick: () => openQuiz(meta)
      }, "開始"));

      // PDFボタン（manifestにpdfがある場合のみ）
      if(meta.pdf){
        right.appendChild(el("button", {
          type:"button",
          class:"mini-btn",
          style:"padding:8px 10px; border-radius:10px; border:1px solid rgba(255,255,255,.25); background:rgba(255,255,255,.08); color:inherit; cursor:pointer;",
          onclick: () => window.open(meta.pdf, "_blank", "noopener,noreferrer")
        }, "PDF"));
      }

      card.appendChild(left);
      card.appendChild(right);
      list.appendChild(card);
    });
  }

  async function openQuiz(meta){
    const main = $("#main");
    if(!main) return;

    const jsonUrl = meta.file || meta.json || meta.path || (meta.id ? `./${meta.id}.json` : null);
    if(!jsonUrl) throw new Error("クイズJSONの場所が manifest にありません。");

    const data = await fetchJson(jsonUrl);

    // クイズ画面
    main.innerHTML = "";
    const wrap = el("section", { class:"card" });
    const header = el("div", { class:"header-row", style:"align-items:center" },
      el("div", {},
        el("h1", { style:"margin:0" }, data.title || meta.title || "クイズ"),
        el("div", { style:"opacity:.75; margin-top:6px" }, `Score: `, el("span", { id:"score", style:"font-weight:800" }, "0"), ` / ${(data.questions||[]).length}`)
      ),
      el("div", { style:"display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end" },
        el("button", { type:"button", class:"segment", onclick: () => { mountListSkeleton(); renderList(); } }, "← 一覧へ"),
        el("button", { type:"button", class:"segment", onclick: () => { openQuiz(meta); } }, "↻ もう一回")
      )
    );

    const body = el("div", { style:"margin-top:14px" });

    let score = 0;
    const total = (data.questions || []).length;
    const updateScore = () => { const s = $("#score"); if(s) s.textContent = String(score); };

    (data.questions || []).forEach((raw, idx) => {
      let item = raw;
      if(CONFIG.shuffleChoices){
        const sh = shuffleWithAnswer(raw.choices || [], raw.answer);
        item = Object.assign({}, raw, { choices: sh.choices, answer: sh.answer });
      }

      const answered = { done:false };
      const result = el("div", { style:"margin-top:10px; font-weight:800; opacity:.95" });

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

              // disable
              card.querySelectorAll("button.choice").forEach(b => b.disabled = true);
            }
          }, `${["A","B","C","D"][i] || (i+1)}. ${text}`))
        ),
        result
      );

      body.appendChild(card);
    });

    wrap.appendChild(header);
    wrap.appendChild(body);
    main.appendChild(wrap);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const state = { quizzes: [], activeCategory: "すべて" };

  async function init(){
    try{
      mountListSkeleton();
      const manifest = await fetchJson("./manifest.json");
      const quizzes = Array.isArray(manifest.quizzes) ? manifest.quizzes : (Array.isArray(manifest) ? manifest : []);
      state.quizzes = quizzes.map(q => Object.assign({}, q, { category: normalizeCategory(q.category) }));
      renderList();
    } catch(err){
      console.error(err);
      const list = $("#quizList");
      if(list){
        list.innerHTML = "";
        list.appendChild(el("div", { class:"choice", style:"cursor:default" },
          el("div", { style:"font-weight:800; margin-bottom:6px" }, "読み込みエラー"),
          el("div", { style:"opacity:.85" }, String(err))
        ));
      } else {
        alert(String(err));
      }
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
