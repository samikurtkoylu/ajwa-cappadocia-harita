/* ═══════════════════════════════════════════════════════════════
   AJWA Cappadocia · İnteraktif Harita — uygulama mantığı
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* Marka uyumlu kahve→altın sıcak kademe (AJWA Brand Manual) */
  const CAT_COLORS = {
    magara: "#5e4630", konaklama: "#7d5a38", yeme: "#9a6c3c", aile: "#b07d40",
    kultur: "#c0903a", etkinlik: "#c59a44", saglik: "#a99a6a", bahce: "#94925c",
  };
  const OUTSIDE_COLOR = "#c0392b"; // parsel dışı (kırmızı bölge) = kullanım harici
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ── Veri ── */
  let DATA = window.AJWA_DATA || null;
  const STORE_KEY = "ajwa.positions.v1";

  /* ── Dil (i18n) ── */
  const LANG_KEY = "ajwa.lang";
  let LANG = (function () { try { return localStorage.getItem(LANG_KEY) === "en" ? "en" : "tr"; } catch (e) { return "tr"; } })();
  const I18N = {
    tr: {
      "meta.title": "AJWA Cappadocia · İnteraktif Yerleşim Haritası",
      "meta.description": "AJWA Cappadocia interaktif yerleşim haritası — mekanlara tıklayın, fotoğrafları keşfedin.",
      "loader.hint": "Yerleşim haritası hazırlanıyor",
      "top.eyebrow": "İnteraktif Yerleşim Haritası",
      "ctrl.3d": "3D Model", "ctrl.video": "Tanıtım Videosu", "ctrl.aerial": "Havadan Görünüm",
      "ctrl.boundary": "Parsel Sınırı", "ctrl.panel": "Mekanlar",
      "legend.in": "Parsel içi", "legend.out": "Parsel dışı",
      "hint.html": 'Haritadaki <b>altın noktalara</b> tıklayarak mekanları keşfedin',
      "panel.title": "Keşfedin",
      "panel.desc": "AJWA Cappadocia’nın mekanlarını gezin — bir mekana dokunun, fotoğrafları görün.",
      "unit.photos": "foto",
      "m3d.eyebrow": "Üç Boyutlu Model",
      "m3d.title": "AJWA Cappadocia · 3D Tesis Modeli",
      "m3d.full": "⤢ Tam ekran",
      "m3d.loadingTitle": "3D model yükleniyor…",
      "m3d.loadingDesc": 'Yüksek çözünürlüklü bir model olduğundan, internet hızınıza göre yüklenmesi <b>biraz zaman alabilir</b>. Lütfen bekleyiniz.',
      "m3d.show": "Yine de göster →",
      "status.outside": "Kullanım Harici",
      "video.eyebrow": "Tanıtım Filmi",
      "video.title": "AJWA Cappadocia · Tanıtım Videosu",
    },
    en: {
      "meta.title": "AJWA Cappadocia · Interactive Site Map",
      "meta.description": "AJWA Cappadocia interactive site map — explore venues, galleries and aerial views.",
      "loader.hint": "Preparing the site map",
      "top.eyebrow": "Interactive Site Map",
      "ctrl.3d": "3D Model", "ctrl.video": "Promo Video", "ctrl.aerial": "Aerial View",
      "ctrl.boundary": "Parcel Boundary", "ctrl.panel": "Places",
      "legend.in": "Inside parcel", "legend.out": "Outside parcel",
      "hint.html": 'Click the <b>golden points</b> on the map to explore the venues',
      "panel.title": "Explore",
      "panel.desc": "Browse AJWA Cappadocia’s venues — tap a place to see its photos.",
      "unit.photos": "photos",
      "m3d.eyebrow": "Three-Dimensional Model",
      "m3d.title": "AJWA Cappadocia · 3D Facility Model",
      "m3d.full": "⤢ Fullscreen",
      "m3d.loadingTitle": "Loading 3D model…",
      "m3d.loadingDesc": 'This is a high-resolution model, so loading <b>may take a while</b> depending on your connection. Please wait.',
      "m3d.show": "Show anyway →",
      "status.outside": "Out of Service",
      "video.eyebrow": "Promotional Film",
      "video.title": "AJWA Cappadocia · Promotional Video",
    },
  };
  const t = k => (I18N[LANG] && I18N[LANG][k]) || I18N.tr[k] || k;
  const catLabel = cat => { const c = DATA.categories[cat] || {}; return (LANG === "en" ? c.en : c.label) || c.label || ""; };
  const locName = loc => (loc.name && (loc.name[LANG] || loc.name.tr)) || loc.title || "";
  const locSub = loc => (loc.sub && (loc.sub[LANG] || loc.sub.tr)) || loc.subtitle || "";

  function applyLang(lang) {
    LANG = (lang === "en") ? "en" : "tr";
    try { localStorage.setItem(LANG_KEY, LANG); } catch (e) {}
    document.documentElement.lang = LANG;
    document.title = t("meta.title");
    const desc = $('meta[name="description"]');
    if (desc) desc.setAttribute("content", t("meta.description"));
    $$("[data-i18n]").forEach(el => { el.textContent = t(el.getAttribute("data-i18n")); });
    $$("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.getAttribute("data-i18n-html")); });
    $$(".lang__opt").forEach(b => {
      const active = b.dataset.lang === LANG;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    buildMarkers();
    buildPanel();
    if (lb.el && !lb.el.hidden) updateLightboxTexts();
  }
  function wireLang() { $$(".lang__opt").forEach(b => b.addEventListener("click", () => applyLang(b.dataset.lang))); }
  function updateLightboxTexts() {
    if (!lb.loc) return;
    $("#lbCat").textContent = catLabel(lb.loc.category);
    $("#lbTitle").textContent = locName(lb.loc);
    $("#lbSub").textContent = locSub(lb.loc);
  }

  function boot(data) {
    DATA = data;
    // Kayıtlı (düzenlenmiş) konumları uygula
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (saved) data.locations.forEach(l => { if (saved[l.slug]) { l.x = saved[l.slug].x; l.y = saved[l.slug].y; } });
    } catch (e) {}
    wireControls();
    wireLightbox();
    wireEdit();
    wire3d();
    wireVideo();
    wireLang();
    const urlLang = new URLSearchParams(location.search).get("lang");
    applyLang(urlLang === "en" || urlLang === "tr" ? urlLang : LANG);   // ?lang=en paylaşılabilir
    hideLoader();
    // derin bağlantı: ?open=slug veya #slug → ilgili galeriyi aç
    const params = new URLSearchParams(location.search);
    const want = params.get("open") || location.hash.replace("#", "");
    if (want && DATA.locations.some(l => l.slug === want)) setTimeout(() => openGallery(want), 200);
    if (params.get("aerial") !== null) setBase("drone");
  }

  // not: boot tetikleyici dosyanın EN SONUNDA çağrılır (lb gibi const’lar
  // initialize olduktan sonra) — aksi halde TDZ hatası oluşur.

  /* ── Açılış perdesi ── */
  function hideLoader() {
    const loader = $("#loader");
    // doğrulama/screenshot kancası: ?shot → anında gizle
    if (location.search.indexOf("shot") > -1) { loader.style.display = "none"; return; }
    const base = $("#mapBase");
    const go = () => setTimeout(() => loader.classList.add("is-gone"), 450);
    if (base.complete) go(); else (base.addEventListener("load", go), base.addEventListener("error", go));
    // güvenlik ağı: görsel takılırsa perdeyi en geç 3.5sn’de kaldır
    setTimeout(() => loader.classList.add("is-gone"), 3500);
  }

  /* ── Hotspot’lar ── */
  function buildMarkers() {
    const wrap = $("#markers");
    wrap.innerHTML = "";
    DATA.locations.forEach((loc, i) => {
      const c = loc.outside ? OUTSIDE_COLOR : (CAT_COLORS[loc.category] || "#c9a44e");
      const b = document.createElement("button");
      b.className = loc.outside ? "marker is-outside" : "marker";
      b.type = "button";
      b.style.left = loc.x + "%";
      b.style.top = loc.y + "%";
      b.style.setProperty("--c", c);
      b.style.animationDelay = (0.9 + i * 0.06) + "s";
      b.dataset.slug = loc.slug;
      b.setAttribute("aria-label", locName(loc) + (loc.outside ? " · " + t("status.outside") : ""));
      b.innerHTML =
        '<span class="marker__pulse"></span>' +
        '<span class="marker__core"></span>' +
        '<span class="marker__label"><span class="ml-eye">' + esc(loc.outside ? t("status.outside") : catLabel(loc.category)) + '</span>' +
        '<span class="ml-name">' + esc(locName(loc)) + '</span></span>';
      b.addEventListener("click", () => { if (!document.body.classList.contains("editing")) openGallery(loc.slug); });
      b.addEventListener("mouseenter", () => syncHot(loc.slug, true));
      b.addEventListener("mouseleave", () => syncHot(loc.slug, false));
      wrap.appendChild(b);
    });
  }

  /* ── Mekan paneli ── */
  function buildPanel() {
    const list = $("#panelList");
    list.innerHTML = "";
    const order = Object.keys(DATA.categories);
    let n = 0;
    order.forEach(catKey => {
      const inCat = DATA.locations.filter(l => l.category === catKey);
      if (!inCat.length) return;
      const meta = DATA.categories[catKey];
      const c = CAT_COLORS[catKey] || "#c9a44e";
      const grp = document.createElement("div");
      grp.className = "cat-group";
      grp.innerHTML = '<div class="cat-group__head" style="--cg:' + c + '">' +
        '<span class="dot"></span><span class="lbl">' + esc(catLabel(catKey)) + '</span><span class="line"></span></div>';
      inCat.forEach(loc => {
        n++;
        const item = document.createElement("button");
        item.className = loc.outside ? "loc is-outside" : "loc";
        item.type = "button";
        item.style.setProperty("--cg", loc.outside ? OUTSIDE_COLOR : c);
        item.dataset.slug = loc.slug;
        item.innerHTML =
          '<span class="loc__no">' + pad(n) + '</span>' +
          '<span class="loc__body"><span class="loc__name">' + esc(locName(loc)) + '</span>' +
          '<span class="loc__sub">' + esc(loc.outside ? t("status.outside") : locSub(loc)) + '</span></span>' +
          '<span class="loc__count"><b>' + loc.count + '</b> ' + esc(t("unit.photos")) + '</span>';
        item.addEventListener("click", () => openGallery(loc.slug));
        item.addEventListener("mouseenter", () => syncHot(loc.slug, true));
        item.addEventListener("mouseleave", () => syncHot(loc.slug, false));
        grp.appendChild(item);
      });
      list.appendChild(grp);
    });
  }

  function syncHot(slug, on) {
    $$('.marker[data-slug="' + slug + '"], .loc[data-slug="' + slug + '"]')
      .forEach(el => el.classList.toggle("is-hot", on));
  }

  /* ── Galeri / Lightbox ── */
  const lb = {
    el: null, img: null, spin: null, idx: 0, photos: [], loc: null, title: "", lastFocus: null,
  };
  function wireLightbox() {
    lb.el = $("#lightbox"); lb.img = $("#lbImg"); lb.spin = $("#lbSpin");
    $$("[data-close]").forEach(b => b.addEventListener("click", closeGallery));
    $("#lbPrev").addEventListener("click", () => step(-1));
    $("#lbNext").addEventListener("click", () => step(1));
    document.addEventListener("keydown", e => {
      if (lb.el.hidden) return;
      if (e.key === "Tab") trapFocus(lb.el, e);
      else if (e.key === "Escape") closeGallery();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    });
  }
  function openGallery(slug) {
    const loc = DATA.locations.find(l => l.slug === slug);
    if (!loc || !loc.photos.length) return;
    lb.loc = loc;
    openPhotos(loc.photos, locName(loc), locSub(loc), catLabel(loc.category));
  }
  function openPhotos(photos, title, sub, cat) {
    if (!photos || !photos.length) return;
    lb.photos = photos; lb.idx = 0; lb.title = title || ""; lb.lastFocus = document.activeElement;
    $("#lbCat").textContent = cat || "";
    $("#lbTitle").textContent = title;
    $("#lbSub").textContent = sub || "";
    const single = photos.length <= 1;             // tek görselde ok/şerit/sayaç gizle
    $("#lbPrev").style.display = single ? "none" : "";
    $("#lbNext").style.display = single ? "none" : "";
    $("#lbThumbs").style.display = single ? "none" : "";
    buildThumbs();
    show(0);
    if (single) $("#lbCount").textContent = "";
    lb.el.hidden = false;
    document.body.style.overflow = "hidden";
    $("#lbClose").focus({ preventScroll: true });
    $("#hint") && $("#hint").classList.add("is-hidden");
  }
  function buildThumbs() {
    const t = $("#lbThumbs"); t.innerHTML = "";
    lb.photos.forEach((src, i) => {
      const d = document.createElement("button");
      d.className = "thumb"; d.dataset.i = i;
      d.type = "button";
      d.setAttribute("aria-label", (lb.title || "Foto") + " " + pad(i + 1) + " / " + pad(lb.photos.length));
      d.innerHTML = '<img loading="lazy" src="' + src + '" alt="">';
      d.addEventListener("click", () => show(i));
      t.appendChild(d);
    });
  }
  function show(i) {
    lb.idx = (i + lb.photos.length) % lb.photos.length;
    const src = lb.photos[lb.idx];
    lb.spin.classList.remove("is-done");
    lb.img.style.opacity = 0;
    lb.img.alt = (lb.title ? lb.title + " · " : "") + pad(lb.idx + 1) + " / " + pad(lb.photos.length);
    const im = new Image();
    im.onload = () => { lb.img.src = src; lb.img.style.opacity = 1; lb.spin.classList.add("is-done"); };
    im.onerror = () => { lb.spin.classList.add("is-done"); };
    im.src = src;
    $("#lbCount").textContent = pad(lb.idx + 1) + " / " + pad(lb.photos.length);
    $$(".thumb").forEach(el => el.classList.toggle("is-active", +el.dataset.i === lb.idx));
    const act = $('.thumb[data-i="' + lb.idx + '"]');
    if (act) act.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    // komşuları önceden yükle
    [lb.idx + 1, lb.idx - 1].forEach(k => { const p = lb.photos[(k + lb.photos.length) % lb.photos.length]; if (p) new Image().src = p; });
  }
  function step(d) { show(lb.idx + d); }
  function closeGallery() {
    lb.el.hidden = true; document.body.style.overflow = "";
    if (lb.lastFocus && typeof lb.lastFocus.focus === "function") lb.lastFocus.focus({ preventScroll: true });
  }

  /* ── 3D Model (gulab.tr iframe — sadece açılınca lazy yüklenir) ── */
  function wire3d() {
    const modal = $("#model3d"), frame = $("#m3dFrame"), loading = $("#m3dLoading"), showBtn = $("#m3dShow");
    let loaded = false, loadingDismissed = false, showTimer = null, lastFocus = null;
    const hideLoading = () => { clearTimeout(showTimer); loadingDismissed = true; loading.style.display = "none"; };
    const scheduleShow = () => {
      clearTimeout(showTimer);
      if (!showBtn) return;
      showBtn.hidden = true;
      showTimer = setTimeout(() => {
        if (!modal.hidden && loading.style.display !== "none") showBtn.hidden = false;
      }, 6000);
    };
    const open = () => {
      lastFocus = document.activeElement;
      modal.hidden = false; document.body.style.overflow = "hidden";
      if (loadingDismissed) loading.style.display = "none";
      else { loading.style.display = "grid"; scheduleShow(); }
      if (!loaded) {
        frame.src = "https://gulab.tr/"; loaded = true;
      }
      $("#m3dClose").focus({ preventScroll: true });
    };
    const close = () => {
      clearTimeout(showTimer);
      modal.hidden = true; document.body.style.overflow = "";
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus({ preventScroll: true });
    };
    $("#btn3d").addEventListener("click", open);
    $$("[data-m3d-close]").forEach(b => b.addEventListener("click", close));
    // Model GERÇEKTEN yüklendiğinde gulab.tr parent'a postMessage gönderirse bilgilendirmeyi kapat.
    // (gulab.tr'ye tek satır eklenince otomatik çalışır; eklenmezse aşağıdaki "Yine de göster" devrede.)
    window.addEventListener("message", e => {
      if (e.origin === "https://gulab.tr" &&
          (e.data === "ajwa-model-loaded" || (e.data && e.data.type === "model-loaded"))) hideLoading();
    });
    if (showBtn) showBtn.addEventListener("click", hideLoading);
    document.addEventListener("keydown", e => {
      if (modal.hidden) return;
      if (e.key === "Tab") trapFocus(modal, e);
      else if (e.key === "Escape") close();
    });
    // derin bağlantı: ?3d → modeli doğrudan aç
    if (new URLSearchParams(location.search).get("3d") !== null) setTimeout(open, 250);
  }

  /* ── Tanıtım Videosu (YouTube, lazy) ── */
  function wireVideo() {
    const modal = $("#video"), frame = $("#videoFrame"), btn = $("#btnVideo");
    if (!btn || !modal || !frame) return;
    const SRC = "https://www.youtube.com/embed/PJHUahbsPyU?si=6lLFYrD-48qnV2PC&rel=0&autoplay=1";
    let lastFocus = null;
    const open = () => {
      lastFocus = document.activeElement;
      modal.hidden = false; document.body.style.overflow = "hidden"; frame.src = SRC;
      $("#videoClose").focus({ preventScroll: true });
    };
    const close = () => {
      modal.hidden = true; document.body.style.overflow = ""; frame.src = ""; // oynatmayı durdur
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus({ preventScroll: true });
    };
    btn.addEventListener("click", open);
    $$("[data-video-close]").forEach(b => b.addEventListener("click", close));
    document.addEventListener("keydown", e => {
      if (modal.hidden) return;
      if (e.key === "Tab") trapFocus(modal, e);
      else if (e.key === "Escape") close();
    });
    if (new URLSearchParams(location.search).get("video") !== null) setTimeout(open, 250); // ?video derin bağlantı
  }

  /* ── Kontroller ── */
  function wireControls() {
    const body = document.body;
    $("#btnBoundary").addEventListener("click", e => {
      const on = body.getAttribute("data-boundary") === "on";
      body.setAttribute("data-boundary", on ? "off" : "on");
      e.currentTarget.setAttribute("aria-pressed", String(!on));
    });
    $("#btnPanel").addEventListener("click", e => {
      const collapsed = $("#panel").classList.toggle("is-collapsed");
      e.currentTarget.classList.toggle("is-active", collapsed);
      e.currentTarget.setAttribute("aria-expanded", String(!collapsed));
    });
    $("#btnFull").addEventListener("click", () => {
      if (!document.fullscreenElement) (document.documentElement.requestFullscreen && document.documentElement.requestFullscreen());
      else document.exitFullscreen();
    });
    $("#btnAerial").addEventListener("click", e => setBase(
      document.body.getAttribute("data-base") !== "drone" ? "drone" : "illustration"));
  }
  // Harita altlığını değiştir: 'illustration' ↔ 'drone' (havadan foto katmanı)
  function setBase(mode) {
    document.body.setAttribute("data-base", mode);
    const b = $("#btnAerial");
    if (b) { b.classList.toggle("is-active", mode === "drone"); b.setAttribute("aria-pressed", String(mode === "drone")); }
  }

  /* ── Düzenleme modu (sürükle-bırak konumlandırma) ── */
  function wireEdit() {
    if (!$("#btnEdit")) return;   // "Konumları Düzenle" butonu kaldırıldı → düzenleme modu kapalı
    const body = document.body;
    const frame = $("#mapframe");
    const inner = $(".mapframe__inner");
    const cross = $("#crosshair");
    let dragging = null;

    $("#btnEdit").addEventListener("click", e => {
      const on = body.classList.toggle("editing");
      e.currentTarget.classList.toggle("is-active", on);
      $("#editbar").hidden = !on;
      cross.hidden = !on;
      if (on) { refreshJson(); toast("Düzenleme modu açık — noktaları sürükleyin"); }
    });
    $("#editClose").addEventListener("click", () => $("#btnEdit").click());
    $("#editCopy").addEventListener("click", () => {
      const ta = $("#editJson"); ta.select();
      navigator.clipboard ? navigator.clipboard.writeText(ta.value).then(() => toast("Koordinatlar kopyalandı ✓"))
        : (document.execCommand("copy"), toast("Koordinatlar kopyalandı ✓"));
    });
    $("#editReset").addEventListener("click", () => {
      localStorage.removeItem(STORE_KEY);
      toast("Konumlar sıfırlandı — sayfa yenileniyor");
      setTimeout(() => location.reload(), 700);
    });

    function rel(e) {
      const r = inner.getBoundingClientRect();
      let x = ((e.clientX - r.left) / r.width) * 100;
      let y = ((e.clientY - r.top) / r.height) * 100;
      return { x: clamp(x), y: clamp(y) };
    }
    inner.addEventListener("pointermove", e => {
      if (!body.classList.contains("editing")) return;
      const r = inner.getBoundingClientRect();
      cross.style.setProperty("--cx", (e.clientX - r.left) + "px");
      cross.style.setProperty("--cy", (e.clientY - r.top) + "px");
      const p = rel(e); $("#crossLabel").textContent = p.x.toFixed(1) + ", " + p.y.toFixed(1);
    });
    $("#markers").addEventListener("pointerdown", e => {
      if (!body.classList.contains("editing")) return;
      const m = e.target.closest(".marker"); if (!m) return;
      e.preventDefault(); dragging = m; m.classList.add("dragging"); m.setPointerCapture(e.pointerId);
    });
    document.addEventListener("pointermove", e => {
      if (!dragging) return;
      const p = rel(e);
      dragging.style.left = p.x + "%"; dragging.style.top = p.y + "%";
      const loc = DATA.locations.find(l => l.slug === dragging.dataset.slug);
      if (loc) { loc.x = +p.x.toFixed(1); loc.y = +p.y.toFixed(1); }
    });
    document.addEventListener("pointerup", () => {
      if (!dragging) return;
      dragging.classList.remove("dragging"); dragging = null;
      persist(); refreshJson();
    });

    function persist() {
      const obj = {};
      DATA.locations.forEach(l => obj[l.slug] = { x: l.x, y: l.y });
      try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); } catch (e) {}
    }
    function refreshJson() {
      $("#editJson").value = JSON.stringify(
        DATA.locations.map(l => ({ slug: l.slug, x: l.x, y: l.y })), null, 0
      ).replace(/},/g, "},\n ");
    }
  }

  /* ── Yardımcılar ── */
  function toast(msg) {
    const t = $("#toast"); t.hidden = false; t.textContent = msg;
    requestAnimationFrame(() => t.classList.add("show"));
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.hidden = true, 400); }, 2200);
  }
  function trapFocus(container, e) {
    const focusable = $$('button, [href], iframe, textarea, input, select, [tabindex]:not([tabindex="-1"])', container)
      .filter(el => !el.disabled && el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function clamp(v) { return Math.max(0, Math.min(100, v)); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  /* ── Başlat (tüm tanımlar yüklendikten sonra) ── */
  if (DATA) { boot(DATA); }
  else {
    fetch("data/locations.json").then(r => r.json()).then(boot).catch(() => {
      document.getElementById("loader").innerHTML =
        '<div class="loader__inner"><div class="loader__sub">Veri yüklenemedi — locations.js bulunamadı</div></div>';
    });
  }
})();
