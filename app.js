/* 時間相機 介面 DEMO — 純前端，不連 Google、不拍照上傳 */
(function () {
  const TZ = "Asia/Taipei";
  const WD = ["一", "二", "三", "四", "五", "六", "日"];
  const TPL_NAMES = ["時間地址", "標準卡片", "工程紀錄", "簡約", "大時間", "藍色商務"];
  const KEY = "timecam-ui-demo-v1";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const defaultState = () => ({
    flash: "off", // off | auto | on
    facing: "back",
    mode: "photo",
    zoom: 1,
    torch: false,
    ext: "標準",
    tpl: 0,
    fields: {
      site: "中和安邦社宅",
      case_: "A-1023",
      bld: "B棟",
      flr: "5F",
      note: "浴室漏水",
      addr: "235新北市中和區安邦巷5弄6號",
      geo: "25.00120, 121.48650（±8m）",
      showAddr: true,
      showExtra: false,
    },
    upload: {
      enabled: false,
      when: "immediate", // immediate | daily
      time: "23:00",
      wifiOnly: true,
      chargingOnly: false,
      folder: "時間相機",
      account: null,
    },
    gallery: [], // data URLs
  });

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!raw) return defaultState();
      const d = defaultState();
      return {
        ...d,
        ...raw,
        fields: { ...d.fields, ...(raw.fields || {}) },
        upload: { ...d.upload, ...(raw.upload || {}) },
        gallery: Array.isArray(raw.gallery) ? raw.gallery.slice(0, 12) : [],
      };
    } catch {
      return defaultState();
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }

  let state = load();
  let recording = false;
  let recStarted = 0;
  let recTimer = null;
  let toastT = 0;

  const now = () => new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));

  function pad(n) { return String(n).padStart(2, "0"); }
  function hm(d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function hms(d) { return hm(d) + ":" + pad(d.getSeconds()); }
  function ymdCN(d) { return d.getFullYear() + "年" + pad(d.getMonth() + 1) + "月" + pad(d.getDate()) + "日"; }
  function ymdSlash(d) { return d.getFullYear() + "/" + pad(d.getMonth() + 1) + "/" + pad(d.getDate()); }
  function week(d) { return "星期" + WD[(d.getDay() + 6) % 7]; } // getDay 0=Sun → 日

  function tick() {
    const d = now();
    $$("[data-clock='hm']").forEach((el) => { el.textContent = hm(d); });
    renderWatermark();
    if (recording) {
      const s = Math.floor((Date.now() - recStarted) / 1000);
      $("#rec-time").textContent = pad(Math.floor(s / 60)) + ":" + pad(s % 60);
    }
  }

  function extraLine() {
    const f = state.fields;
    if (!f.showExtra) return "";
    return [f.site, f.case_, [f.bld, f.flr].filter(Boolean).join(" "), f.note].filter(Boolean).join(" · ");
  }

  function renderWatermark() {
    const el = $("#watermark");
    if (!el) return;
    const d = now();
    const f = state.fields;
    const addr = f.showAddr ? f.addr : "";
    const extra = extraLine();
    const tpl = state.tpl;
    el.dataset.tpl = String(tpl);

    if (tpl === 0 || tpl === 4) {
      const dateStr = tpl === 4 ? ymdSlash(d) : ymdCN(d);
      const wk = tpl === 4 ? (week(d) + "  " + pad(d.getSeconds()) + "秒") : week(d);
      el.innerHTML =
        `<div class="wm-top">
          <div class="wm-time">${hm(d)}</div>
          <div class="wm-bar"></div>
          <div class="wm-meta"><div class="wm-date">${dateStr}</div><div class="wm-wk">${wk}</div></div>
        </div>` +
        (addr ? `<div class="wm-addr">${esc(addr)}</div>` : "") +
        (extra ? `<div class="wm-extra">${esc(extra)}</div>` : "") +
        (tpl === 4 && f.site && !f.showExtra ? `<div class="wm-extra" style="color:#ffd02a">${esc(f.site)}</div>` : "");
      return;
    }
    if (tpl === 1) {
      el.innerHTML = `<div class="wm-card">
        <div class="c-site">${esc(f.site || "時間相機")}</div>
        <div class="c-time">${hm(d)}<small>${pad(d.getSeconds())}</small></div>
        <div class="c-date">${ymdSlash(d)}  ${week(d)}</div>
        ${row("#","案號", f.case_)}${row("樓","棟別樓層", [f.bld,f.flr].filter(Boolean).join(" · "))}
        ${row("註","備註", f.note)}${f.showAddr ? row("址","地址", f.addr) : ""}
        ${row("經","經緯度", f.geo)}
      </div>`;
      return;
    }
    if (tpl === 2) {
      const rows = [
        ["日期", ymdSlash(d) + "  " + week(d)],
        ["時間", hms(d)],
        ["案號", f.case_],
        ["棟別樓層", [f.bld, f.flr].filter(Boolean).join(" · ")],
        ["備註", f.note],
        f.showAddr ? ["地址", f.addr] : null,
        ["經緯度", f.geo],
      ].filter((r) => r && r[1]);
      el.innerHTML = `<div class="wm-board"><div class="bh">${esc(f.site || "工程紀錄")}</div>${
        rows.map(([k,v]) => `<div class="br"><div class="bk">${esc(k)}</div><div class="bv">${esc(v)}</div></div>`).join("")
      }</div>`;
      return;
    }
    if (tpl === 3) {
      el.innerHTML = `<div class="wm-min">
        <div class="hm">${hms(d)}</div>
        <div class="sub">${ymdSlash(d)}  ${week(d)}</div>
        <div class="site">${esc(f.site || "")}</div>
        <div class="sub">${esc([f.case_, [f.bld,f.flr].filter(Boolean).join(" "), f.note, f.showAddr ? f.addr : "", f.geo].filter(Boolean).join("　"))}</div>
      </div>`;
      return;
    }
    if (tpl === 5) {
      el.innerHTML = `<div class="wm-blue">
        <div class="hd"><span>${esc(f.site || "時間相機")}</span><b>${hm(d)}</b></div>
        <div class="bd"><div class="dt">${ymdSlash(d)}  ${week(d)}　${hms(d)}</div>
          ${f.case_ ? `<div class="br"><span class="k">案號</span><span>${esc(f.case_)}</span></div>` : ""}
          ${[f.bld,f.flr].filter(Boolean).length ? `<div class="br"><span class="k">棟別樓層</span><span>${esc([f.bld,f.flr].filter(Boolean).join(" · "))}</span></div>` : ""}
          ${f.note ? `<div class="br"><span class="k">備註</span><span>${esc(f.note)}</span></div>` : ""}
          ${f.showAddr && f.addr ? `<div class="br"><span class="k">地址</span><span>${esc(f.addr)}</span></div>` : ""}
          ${f.geo ? `<div class="br"><span class="k">經緯度</span><span>${esc(f.geo)}</span></div>` : ""}
        </div>
      </div>`;
    }
  }
  function row(icon, k, v) {
    if (!v) return "";
    return `<div class="c-row"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`;
  }
  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]));
  }

  const FLASH_ICONS = {
    off: `<svg viewBox="0 0 24 24"><path d="M11.2 2.4L5.2 13.2h5.1l-1.6 8.4 8.2-13.2h-5.1L13.4 2.4z" fill="currentColor"/><path d="M4.2 4.2l15.6 15.6" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><path d="M4.2 4.2l15.6 15.6" fill="none" stroke="#111" stroke-width="1.9" stroke-linecap="round"/></svg>`,
    auto: `<svg viewBox="0 0 24 24"><path d="M9.8 2.4L4.2 13.2h5.1L7.8 21.4 17.2 8.8h-5.2L13.6 2.4z" fill="currentColor"/><text x="23" y="22" text-anchor="end" font-size="8.5" font-weight="800" fill="currentColor" font-family="sans-serif">A</text></svg>`,
    on: `<svg viewBox="0 0 24 24"><path d="M11.2 2.4L5.2 13.2h5.1l-1.6 8.4 8.2-13.2h-5.1L13.4 2.4z" fill="currentColor"/></svg>`,
  };

  function renderFlash() {
    const b = $("#btn-flash");
    b.dataset.state = state.flash;
    b.innerHTML = FLASH_ICONS[state.flash];
    b.classList.toggle("is-on", state.flash === "on");
    b.setAttribute("aria-label", "閃光燈：" + ({ off:"關", auto:"自動", on:"開" }[state.flash]));
  }

  function renderPreviewChrome() {
    const p = $("#preview");
    p.dataset.zoom = String(state.zoom);
    p.classList.toggle("is-front", state.facing === "front");
    p.classList.toggle("is-torch", state.torch);
    $$(".zoom-btn").forEach((b) => {
      const z = parseFloat(b.dataset.zoom);
      const on = z === state.zoom;
      b.classList.toggle("on", on);
      b.textContent = z === 1 ? "1×" : String(z);
    });
    const video = state.mode === "video";
    $("#btn-shutter").classList.toggle("is-video", video);
    $("#btn-shutter").classList.toggle("is-rec", recording);
    $("#mode-photo").classList.toggle("on", !video);
    $("#mode-video").classList.toggle("on", video);
    $("#mode-photo").setAttribute("aria-selected", String(!video));
    $("#mode-video").setAttribute("aria-selected", String(video));
    $("#rec-badge").hidden = !recording;
    renderFlash();
    renderThumb();
  }

  function renderThumb() {
    const box = $("#last-thumb");
    const src = state.gallery[0];
    if (src) {
      box.innerHTML = `<img src="${src}" alt="最近一張">`;
    } else {
      box.innerHTML = `<span class="thumb-ph"></span>`;
    }
  }

  function toast(msg, ms = 2200) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.hidden = true; }, ms);
  }

  /* overlays */
  const scrim = $("#scrim");
  const drawer = $("#drawer");
  const sheet = $("#sheet");

  function closeOverlays() {
    drawer.classList.remove("is-on");
    drawer.setAttribute("aria-hidden", "true");
    sheet.classList.remove("is-on");
    setTimeout(() => { if (!sheet.classList.contains("is-on")) sheet.hidden = true; }, 320);
    const any = drawer.classList.contains("is-on");
    if (!any) scrim.hidden = true;
  }
  function showScrim() { scrim.hidden = false; }

  function openDrawer() {
    drawer.innerHTML = `
      <h3>時間相機</h3>
      <button class="d-item" data-act="settings">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 3.5v2.2M12 18.3v2.2M4.6 6.5l1.6 1.6M17.8 15.9l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.6 17.5l1.6-1.6M17.8 8.1l1.6-1.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        設定
      </button>
      <button class="d-item" data-act="torch">
        <svg viewBox="0 0 24 24"><path d="M8 10.5V7.2A4 4 0 0 1 16 7.2v3.3M8 10.5h8v8.2a4 4 0 0 1-8 0V10.5z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 14v3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        手電筒 <span class="right">${state.torch ? "開" : "關"}</span>
      </button>
      <button class="d-item" data-act="ext">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 8v4l2.5 1.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        影像模式 <span class="right">${state.ext}</span>
      </button>
      <button class="d-item" data-act="stamp">
        <svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 16l2.2-2.6 1.7 1.8 2.4-3 3.2 3.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
        幫已有照片加浮水印
      </button>
      <div class="d-foot">這是介面示範，手電筒與影像模式只會改預覽樣子，不會真的控制相機。</div>`;
    showScrim();
    drawer.classList.add("is-on");
    drawer.setAttribute("aria-hidden", "false");
  }

  function openSheet(html) {
    sheet.innerHTML = `<div class="grab"></div>${html}`;
    sheet.hidden = false;
    requestAnimationFrame(() => sheet.classList.add("is-on"));
    showScrim();
    bindSheet();
  }

  function bindSheet() {
    const done = sheet.querySelector("[data-act='close']");
    if (done) done.addEventListener("click", closeOverlays);
    sheet.querySelectorAll("[data-tpl]").forEach((b) => {
      b.addEventListener("click", () => {
        state.tpl = parseInt(b.dataset.tpl, 10);
        save();
        renderWatermark();
        openTemplates(); // refresh selection
      });
    });
    sheet.querySelectorAll("[data-field]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const k = inp.dataset.field;
        state.fields[k] = inp.value;
        save();
        renderWatermark();
      });
    });
    sheet.querySelectorAll("[data-toggle]").forEach((sw) => {
      sw.addEventListener("click", () => {
        const k = sw.dataset.toggle;
        state.fields[k] = !state.fields[k];
        save();
        renderWatermark();
        sw.classList.toggle("on", state.fields[k]);
      });
    });
    const reloc = sheet.querySelector("[data-act='reloc']");
    if (reloc) reloc.addEventListener("click", () => {
      reloc.textContent = "定位中…";
      setTimeout(() => {
        // 示範：地址維持同一處，只更新狀態文字
        state.fields.geo = "25.00118, 121.48647（±6m）";
        save();
        toast("已更新定位（示範資料）");
        openLocation();
      }, 700);
    });
  }

  function openTemplates() {
    const cards = TPL_NAMES.map((name, i) => {
      return `<button class="tpl-card ${state.tpl === i ? "on" : ""}" data-tpl="${i}">
        <div class="pv"><img src="assets/preview.jpg" alt=""><div class="mini" style="transform:scale(.42)">${miniHint(i)}</div></div>
        <div class="nm">${name}</div>
      </button>`;
    }).join("");
    openSheet(`
      <div class="sheet-hd"><h3>浮水印範本</h3><button class="done" data-act="close">完成</button></div>
      <p class="s-note" style="padding:0 0 10px">選一種樣式，會同步出現在預覽與之後拍下的示範照片上。</p>
      <div class="tpl-grid">${cards}</div>`);
  }
  function miniHint(i) {
    if (i === 0 || i === 4) return `<div style="color:#fff;font-weight:800;font-size:42px;text-shadow:0 2px 6px #000">10:14</div>`;
    if (i === 1) return `<div style="background:rgba(14,16,22,.7);color:#fff;padding:8px 10px;border-radius:8px;border-left:4px solid #ffb020;font-size:11px">標準卡片</div>`;
    if (i === 2) return `<div style="background:#1e6b3a;color:#fff;padding:6px 10px;font-size:11px;font-weight:700">工程紀錄</div>`;
    if (i === 3) return `<div style="color:#fff;font-weight:800;font-size:20px;text-shadow:0 2px 6px #000">10:14:02</div>`;
    return `<div style="background:#1f5fbf;color:#fff;padding:6px 10px;font-size:11px;font-weight:700">藍色商務</div>`;
  }

  function openEdit() {
    const f = state.fields;
    openSheet(`
      <div class="sheet-hd"><h3>編輯浮水印</h3><button class="done" data-act="close">完成</button></div>
      <label class="form-label">社宅名稱</label>
      <input class="form-in" data-field="site" value="${esc(f.site)}">
      <label class="form-label">案號</label>
      <input class="form-in" data-field="case_" value="${esc(f.case_)}">
      <div style="display:flex;gap:10px">
        <div style="flex:1"><label class="form-label">棟別</label><input class="form-in" data-field="bld" value="${esc(f.bld)}"></div>
        <div style="flex:1"><label class="form-label">樓層</label><input class="form-in" data-field="flr" value="${esc(f.flr)}"></div>
      </div>
      <label class="form-label">備註</label>
      <input class="form-in" data-field="note" value="${esc(f.note)}">
      <label class="form-label">地址（示範可改，正式 App 會自動定位）</label>
      <input class="form-in" data-field="addr" value="${esc(f.addr)}">
      <div class="row" style="padding:12px 0 0">
        <div class="label">浮水印顯示地址</div>
        <button class="sw ${f.showAddr ? "on" : ""}" data-toggle="showAddr" type="button" aria-label="顯示地址"><i></i></button>
      </div>
      <div class="row" style="padding:8px 0 4px">
        <div class="label">時間地址樣式一併顯示案號／棟別<div class="sub">預設只顯示時間、日期與地址，跟參考畫面一樣</div></div>
        <button class="sw ${f.showExtra ? "on" : ""}" data-toggle="showExtra" type="button" aria-label="顯示案號"><i></i></button>
      </div>`);
  }

  function openLocation() {
    const f = state.fields;
    openSheet(`
      <div class="sheet-hd"><h3>拍攝位置</h3><button class="done" data-act="close">完成</button></div>
      <div class="loc-card">
        <div class="big">${esc(f.addr || "尚無地址")}</div>
        <div class="geo">${esc(f.geo)} · 示範資料</div>
      </div>
      <div class="row" style="padding:4px 0">
        <div class="label">浮水印顯示地址</div>
        <button class="sw ${f.showAddr ? "on" : ""}" data-toggle="showAddr" type="button"><i></i></button>
      </div>
      <div class="loc-actions">
        <button data-act="reloc" type="button">重新定位</button>
      </div>
      <p class="s-note" style="padding:12px 0 0">這是示範，不會讀取你手機的真實定位。</p>`);
  }

  /* settings */
  function openSettings() {
    closeOverlays();
    renderSettings();
    $("#screen-settings").classList.add("is-on");
  }
  function closeSettings() { $("#screen-settings").classList.remove("is-on"); }

  function renderSettings() {
    const u = state.upload;
    const off = !u.enabled;
    $("#settings-body").innerHTML = `
      <p class="s-note">以下是正式 App 打算做的自動備份選項。這個 DEMO 只記住你點的設定，<b>不會連結 Google，也不會上傳任何檔案</b>。</p>
      <div class="card">
        <div class="row">
          <div class="label">自動上傳 Google 雲端<div class="sub">拍完或每天固定時間，存到雲端硬碟</div></div>
          <button class="sw ${u.enabled ? "on" : ""}" id="sw-upload" type="button" aria-label="自動上傳"><i></i></button>
        </div>
      </div>
      <div class="card ${off ? "is-disabled" : ""}" id="upload-opts">
        <div class="row row-stack">
          <div class="label">上傳時間</div>
          <label class="choice"><input type="radio" name="when" value="immediate" ${u.when === "immediate" ? "checked" : ""}>拍完馬上</label>
          <label class="choice"><input type="radio" name="when" value="daily" ${u.when === "daily" ? "checked" : ""}>每天指定時間</label>
          <div class="time-row ${u.when === "daily" ? "" : "dim"}">每天在
            <input class="time-in" id="upload-time" type="text" inputmode="numeric" maxlength="5" value="${esc(u.time)}" ${u.when === "daily" ? "" : "disabled"} aria-label="每天上傳時刻">
            自動上傳
          </div>
        </div>
        <div class="row">
          <div class="label">只在 Wi‑Fi 上傳<div class="sub">用行動網路時先留在手機</div></div>
          <button class="sw ${u.wifiOnly ? "on" : ""}" id="sw-wifi" type="button"><i></i></button>
        </div>
        <div class="row">
          <div class="label">只在充電時上傳</div>
          <button class="sw ${u.chargingOnly ? "on" : ""}" id="sw-chg" type="button"><i></i></button>
        </div>
        <div class="row row-stack">
          <div class="label">雲端資料夾名稱</div>
          <input class="field-in" id="upload-folder" value="${esc(u.folder)}" maxlength="40">
        </div>
      </div>
      <div class="card" id="acct-card"></div>
      <div class="ver">介面 DEMO · 對應時間相機現有功能，尚未出新版 App</div>`;
    renderAccount();
    $("#sw-upload").addEventListener("click", () => {
      state.upload.enabled = !state.upload.enabled;
      if (state.upload.enabled && !state.upload.account) {
        toast("請先連結 Google 帳號（示範）");
      }
      save();
      renderSettings();
    });
    $("#upload-opts").addEventListener("change", (e) => {
      if (e.target.name === "when") {
        state.upload.when = e.target.value;
        save();
        renderSettings();
      }
    });
    const tm = $("#upload-time");
    if (tm) tm.addEventListener("change", () => { state.upload.time = tm.value || "23:00"; save(); });
    $("#sw-wifi").addEventListener("click", () => { state.upload.wifiOnly = !state.upload.wifiOnly; save(); renderSettings(); });
    $("#sw-chg").addEventListener("click", () => { state.upload.chargingOnly = !state.upload.chargingOnly; save(); renderSettings(); });
    $("#upload-folder").addEventListener("input", (e) => { state.upload.folder = e.target.value; save(); });
  }

  function renderAccount() {
    const box = $("#acct-card");
    if (!box) return;
    const acc = state.upload.account;
    if (!acc) {
      box.innerHTML = `<div class="row row-stack">
        <div class="label">Google 帳號<div class="sub">示範按鈕，不會跳出 Google 登入</div></div>
        <button class="btn-block" id="btn-connect" type="button">連結 Google 帳號</button>
      </div>`;
      $("#btn-connect").addEventListener("click", mockConnect);
    } else {
      box.innerHTML = `<div class="row">
        <div class="acct">
          <div class="av">D</div>
          <div class="meta"><b>${esc(acc)}</b><span>已連結（示範，未真正授權）</span></div>
        </div>
        <button class="btn-ghost" id="btn-disconnect" type="button">中斷</button>
      </div>`;
      $("#btn-disconnect").addEventListener("click", () => {
        state.upload.account = null;
        state.upload.enabled = false;
        save();
        toast("已中斷（示範）");
        renderSettings();
      });
    }
  }

  function mockConnect() {
    const btn = $("#btn-connect");
    if (btn) { btn.disabled = true; btn.textContent = "連結中…"; }
    toast("這是示範，不會真的連結 Google 帳號");
    setTimeout(() => {
      state.upload.account = "demo@gmail.com";
      save();
      renderSettings();
    }, 900);
  }

  /* gallery */
  function openGallery() {
    closeOverlays();
    renderGallery();
    $("#screen-gallery").classList.add("is-on");
  }
  function closeGallery() {
    const v = $("#viewer");
    if (v) v.remove();
    $("#screen-gallery").classList.remove("is-on");
  }
  function renderGallery() {
    const box = $("#gallery-body");
    if (!state.gallery.length) {
      box.innerHTML = `<div class="gallery-empty">還沒有示範照片。<br>回到相機按快門，就會出現在這裡。<br>（不會存進你手機的相簿）</div>`;
      return;
    }
    box.innerHTML = `<div class="gallery-grid">${state.gallery.map((src, i) =>
      `<button class="cell" data-i="${i}"><img src="${src}" alt="示範照片 ${i+1}"></button>`
    ).join("")}</div>`;
    box.querySelectorAll(".cell").forEach((b) => b.addEventListener("click", () => viewPhoto(+b.dataset.i)));
  }
  function viewPhoto(i) {
    const src = state.gallery[i];
    if (!src) return;
    const v = document.createElement("div");
    v.className = "viewer";
    v.id = "viewer";
    v.innerHTML = `<div class="vbar"><button class="tb-icon" id="btn-close-view" aria-label="關閉" style="color:#fff">
      <svg viewBox="0 0 24 24"><path d="M15.2 5.2L8.5 12l6.7 6.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button><span style="font-weight:700">本機照片</span></div><img src="${src}" alt="">`;
    $("#screen-gallery").appendChild(v);
    $("#btn-close-view").addEventListener("click", () => v.remove());
  }

  /* capture (demo) */
  function capturePreview() {
    const img = $("#preview-img");
    const canvas = document.createElement("canvas");
    const w = 864, h = 1152;
    canvas.width = w; canvas.height = h;
    const c = canvas.getContext("2d");
    const z = state.zoom === 0.5 ? 0.72 : state.zoom;
    const iw = img.naturalWidth || w, ih = img.naturalHeight || h;
    const scale = Math.max(w / iw, h / ih) * z;
    const dw = iw * scale, dh = ih * scale;
    c.save();
    if (state.facing === "front") { c.translate(w, 0); c.scale(-1, 1); }
    c.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    c.restore();
    if (state.torch) { c.fillStyle = "rgba(255,244,210,.18)"; c.fillRect(0,0,w,h); }
    // draw current watermark by cloning computed look via an offscreen render of the HTML is hard;
    // stamp the default/large time style (and card styles) with canvas.
    stampCanvas(c, w, h);
    return canvas.toDataURL("image/jpeg", 0.88);
  }

  function stampCanvas(c, w, h) {
    const d = now();
    const f = state.fields;
    const addr = f.showAddr ? f.addr : "";
    const extra = extraLine();
    c.save();
    c.shadowColor = "rgba(0,0,0,.55)";
    c.shadowBlur = 8;
    c.shadowOffsetY = 2;
    c.fillStyle = "#fff";
    const left = 36, bottom = h - 36;
    if (state.tpl === 0 || state.tpl === 4) {
      c.font = "800 118px 'Noto Sans CJK TC', sans-serif";
      const time = hm(d);
      const tw = c.measureText(time).width;
      const timeY = bottom - (addr ? 70 : 8);
      c.fillText(time, left, timeY);
      c.shadowBlur = 0;
      c.fillStyle = "#FFD02A";
      c.fillRect(left + tw + 18, timeY - 96, 8, 108);
      c.fillStyle = "#fff";
      c.shadowBlur = 8;
      c.font = "700 32px 'Noto Sans CJK TC', sans-serif";
      const rx = left + tw + 42;
      const date = state.tpl === 4 ? ymdSlash(d) : ymdCN(d);
      const wk = state.tpl === 4 ? week(d) + "  " + pad(d.getSeconds()) + "秒" : week(d);
      c.fillText(date, rx, timeY - 52);
      c.fillText(wk, rx, timeY - 10);
      c.font = "600 28px 'Noto Sans CJK TC', sans-serif";
      if (addr) c.fillText(addr, left, bottom - 8, w - 80);
      if (extra) c.fillText(extra, left, bottom + 28 > h ? bottom - 8 : bottom + 20, w - 80);
    } else {
      c.shadowBlur = 0;
      c.font = "700 36px 'Noto Sans CJK TC', sans-serif";
      c.fillStyle = "#fff";
      const lines = [hm(d) + "  " + ymdCN(d), addr, extra].filter(Boolean);
      lines.forEach((t, i) => c.fillText(t, left, bottom - (lines.length - 1 - i) * 44, w - 80));
    }
    c.restore();
  }

  function takePhoto() {
    $("#flash-fx").classList.remove("bang");
    void $("#flash-fx").offsetWidth;
    $("#flash-fx").classList.add("bang");
    const url = capturePreview();
    state.gallery.unshift(url);
    state.gallery = state.gallery.slice(0, 12);
    save();
    renderThumb();
    if (state.upload.enabled && state.upload.account && state.upload.when === "immediate") {
      toast("已儲存（示範）。設定為拍完即上傳，這裡不會真的傳到雲端");
    } else {
      toast("已儲存到本機照片（示範，不會寫入手機相簿）");
    }
  }

  function toggleRec() {
    if (!recording) {
      recording = true;
      recStarted = Date.now();
      $("#rec-badge").hidden = false;
      renderPreviewChrome();
    } else {
      recording = false;
      const url = capturePreview();
      state.gallery.unshift(url);
      state.gallery = state.gallery.slice(0, 12);
      save();
      renderThumb();
      renderPreviewChrome();
      toast("影片已存成示範畫面（DEMO 不會真的錄影）");
    }
  }

  /* events */
  function bind() {
    $("#btn-menu").addEventListener("click", openDrawer);
    $("#btn-flash").addEventListener("click", () => {
      state.flash = state.flash === "off" ? "auto" : state.flash === "auto" ? "on" : "off";
      save();
      renderFlash();
      toast("閃光燈：" + ({ off:"關", auto:"自動", on:"開" }[state.flash]));
    });
    $("#btn-wm-entry").addEventListener("click", openEdit);
    $("#btn-flip").addEventListener("click", () => {
      if (recording) { toast("錄影中不能切換鏡頭"); return; }
      state.facing = state.facing === "back" ? "front" : "back";
      save();
      renderPreviewChrome();
    });
    $("#btn-edit").addEventListener("click", openEdit);
    $("#btn-pin").addEventListener("click", openLocation);
    $("#btn-tpl").addEventListener("click", openTemplates);
    $("#btn-gallery").addEventListener("click", openGallery);
    $("#btn-shutter").addEventListener("click", () => {
      if (state.mode === "video") toggleRec();
      else takePhoto();
    });
    $("#mode-photo").addEventListener("click", () => {
      if (recording) return;
      state.mode = "photo";
      save();
      renderPreviewChrome();
    });
    $("#mode-video").addEventListener("click", () => {
      state.mode = "video";
      save();
      renderPreviewChrome();
    });
    $$(".zoom-btn").forEach((b) => b.addEventListener("click", () => {
      state.zoom = parseFloat(b.dataset.zoom);
      save();
      renderPreviewChrome();
    }));
    $("#btn-settings-back").addEventListener("click", closeSettings);
    $("#btn-gallery-back").addEventListener("click", closeGallery);

    scrim.addEventListener("click", closeOverlays);
    drawer.addEventListener("click", (e) => {
      const item = e.target.closest("[data-act]");
      if (!item) return;
      const act = item.dataset.act;
      if (act === "settings") openSettings();
      if (act === "torch") {
        state.torch = !state.torch;
        save();
        renderPreviewChrome();
        openDrawer();
        toast("手電筒：" + (state.torch ? "開（示範）" : "關"));
      }
      if (act === "ext") {
        if (state.mode === "video") { toast("HDR／夜間僅適用於照片模式"); return; }
        const list = ["標準", "HDR", "夜間"];
        state.ext = list[(list.indexOf(state.ext) + 1) % list.length];
        save();
        openDrawer();
        toast("影像模式：" + state.ext + "（示範）");
      }
      if (act === "stamp") {
        closeOverlays();
        toast("示範：正式 App 可選一張已有照片加上浮水印。這裡先略過檔案選取。");
      }
    });
  }

  /* shot helpers for puppeteer */
  window.__demo = {
    openSettings, openTemplates, openEdit, openLocation, openGallery, openDrawer, closeOverlays,
    set(k, v) { Object.assign(state, typeof k === "object" ? k : { [k]: v }); save(); renderPreviewChrome(); renderWatermark(); },
    state: () => state,
    seedPhoto() { if (!state.gallery.length) { state.gallery.unshift(capturePreview()); save(); renderThumb(); } },
  };

  function boot() {
    const q = new URLSearchParams(location.search);
    if (q.get("shot")) document.documentElement.classList.add("shot");
    bind();
    renderPreviewChrome();
    renderWatermark();
    tick();
    setInterval(tick, 1000);
    // seed one demo still so 本機照片有縮圖
    const img = $("#preview-img");
    const seed = () => { try { if (!state.gallery.length) { state.gallery.unshift(capturePreview()); save(); renderThumb(); } } catch {} };
    if (img.complete) setTimeout(seed, 50);
    else img.addEventListener("load", () => setTimeout(seed, 50));
    if (q.get("open") === "settings") setTimeout(openSettings, 60);
    if (q.get("open") === "tpl") setTimeout(openTemplates, 60);
    if (q.get("open") === "edit") setTimeout(openEdit, 60);
    if (q.get("open") === "pin") setTimeout(openLocation, 60);
    if (q.get("open") === "gallery") setTimeout(openGallery, 80);
    if (q.get("open") === "video") { state.mode = "video"; renderPreviewChrome(); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
