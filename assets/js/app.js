/* ===========================================================================
   CyberEdge Security+ Learning Hub
   Application shell logic. Self-contained, no framework, no build step.
=========================================================================== */
(function () {
  "use strict";

  var STORE_KEY = "cyberedge-hub-v1";
  var SHELL = "ceh-shell", LESSON = "ceh-lesson";

  /* ---------- Persistent state ---------- */
  var state = load();
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      return {
        progress: s.progress || {},   // { "<number>": {status,pct,index,label,scrollY,updatedAt} }
        bookmarks: s.bookmarks || [],  // [{lesson,label,sectionIndex,createdAt}]
        theme: s.theme || prefersDark(),
        lastLesson: s.lastLesson || null
      };
    } catch (e) {
      return { progress: {}, bookmarks: [], theme: prefersDark(), lastLesson: null };
    }
  }
  function prefersDark() {
    return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  }
  var saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
    }, 180);
  }

  /* ---------- Data ---------- */
  var DATA = { domains: [], lessons: [], byNumber: {}, domainById: {}, order: [], search: [] };

  function boot() {
    fetch("data/courses.json").then(function (r) { return r.json(); }).then(function (courses) {
      var active = courses.courses.find(function (c) { return c.id === courses.activeCourse; }) || courses.courses[0];
      return Promise.all([
        fetch(active.manifest).then(function (r) { return r.json(); }),
        fetch(active.searchIndex).then(function (r) { return r.json(); }).catch(function () { return { entries: [] }; })
      ]);
    }).then(function (res) {
      var manifest = res[0], search = res[1];
      DATA.domains = manifest.domains;
      DATA.lessons = manifest.lessons.slice().sort(function (a, b) { return a.number - b.number; });
      DATA.order = DATA.lessons.map(function (l) { return l.number; });
      DATA.lessons.forEach(function (l) { DATA.byNumber[l.number] = l; });
      DATA.domains.forEach(function (d) { DATA.domainById[d.id] = d; });
      DATA.search = search.entries || [];
      renderSidebar();
      renderDashboard();
      route();
    }).catch(function (e) {
      document.getElementById("view-dashboard").innerHTML =
        '<div class="empty"><h2>Could not load the course</h2><p>The lesson data files did not load. If you opened this file directly, run it from a web server or your published site so the app can read its data.</p></div>';
      console.error(e);
    });
  }

  /* ---------- Helpers ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function prog(num) {
    return state.progress[num] || { status: "not-started", pct: 0, index: 0, label: "", scrollY: 0 };
  }
  function statusLabel(st) {
    return st === "complete" ? "Complete" : st === "in-progress" ? "In progress" : "Not started";
  }
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg; t.hidden = false;
    requestAnimationFrame(function () { t.classList.add("show"); });
    clearTimeout(t._timer);
    t._timer = setTimeout(function () {
      t.classList.remove("show");
      setTimeout(function () { t.hidden = true; }, 280);
    }, 2400);
  }

  /* ---------- Sidebar ---------- */
  function renderSidebar() {
    var wrap = $("#sidebarLessons");
    wrap.innerHTML = "";
    DATA.domains.forEach(function (d) {
      var lessons = DATA.lessons.filter(function (l) { return l.domain === d.id; });
      var box = el("div", "side-domain");
      box.dataset.domain = d.id;
      var btn = el("button", "side-domain-btn");
      btn.innerHTML =
        '<span class="dot" style="background:' + d.accent + '"></span>' +
        '<span>Domain ' + d.id + ' · ' + esc(shortDomain(d.name)) + '</span>' +
        '<svg class="chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>';
      btn.addEventListener("click", function () { box.classList.toggle("open"); });
      var list = el("div", "side-domain-list");
      lessons.forEach(function (l) {
        var a = el("a", "side-lesson");
        a.href = "#/lesson/" + l.number;
        a.dataset.lesson = l.number;
        a.innerHTML =
          '<span class="lnum">L' + l.number + '</span>' +
          '<span class="ltext">' + esc(l.title) + '</span>' +
          '<span class="s-dot"></span>';
        list.appendChild(a);
      });
      box.appendChild(btn); box.appendChild(list);
      wrap.appendChild(box);
    });
    refreshSidebarStatus();
  }
  function shortDomain(name) {
    return name.replace(" & Oversight", "").replace(", Vulnerabilities & Mitigations", " & Vulns");
  }
  function refreshSidebarStatus() {
    DATA.lessons.forEach(function (l) {
      var dot = document.querySelector('.side-lesson[data-lesson="' + l.number + '"] .s-dot');
      if (dot) dot.className = "s-dot " + prog(l.number).status;
    });
    var done = countDone();
    $("#sideProgressLabel").textContent = done + " of " + DATA.lessons.length + " complete";
    $("#sideProgressFill").style.width = (done / DATA.lessons.length * 100) + "%";
  }
  function countDone() {
    return DATA.lessons.filter(function (l) { return prog(l.number).status === "complete"; }).length;
  }
  function countProg() {
    return DATA.lessons.filter(function (l) { return prog(l.number).status === "in-progress"; }).length;
  }

  /* ---------- Dashboard ---------- */
  function renderDashboard() {
    renderResume();
    renderOverall();
    var groups = $("#domainGroups");
    groups.innerHTML = "";
    DATA.domains.forEach(function (d) {
      var lessons = DATA.lessons.filter(function (l) { return l.domain === d.id; });
      var done = lessons.filter(function (l) { return prog(l.number).status === "complete"; }).length;
      var sec = el("section", "domain");
      sec.id = "domain-" + d.id;
      var head = el("div", "domain-head");
      head.innerHTML =
        '<div class="domain-badge" style="background:' + d.accent + '">' + d.id + '</div>' +
        '<div class="domain-meta">' +
          '<p class="domain-name">' + esc(d.name) + '</p>' +
          '<p class="domain-sub">' + done + ' of ' + lessons.length + ' lessons complete</p>' +
        '</div>' +
        '<span class="domain-weight"><b>' + d.weight + '%</b> of exam</span>';
      sec.appendChild(head);
      var grid = el("div", "lesson-grid");
      lessons.forEach(function (l) { grid.appendChild(lessonCard(l)); });
      sec.appendChild(grid);
      groups.appendChild(sec);
    });
  }

  function lessonCard(l) {
    var p = prog(l.number);
    var hasBm = state.bookmarks.some(function (b) { return b.lesson === l.number; });
    var a = el("a", "lcard" + (hasBm ? " has-bm" : ""));
    a.href = "#/lesson/" + l.number;
    var pct = Math.round((p.pct || 0) * 100);
    a.innerHTML =
      '<svg class="lcard-bm" viewBox="0 0 24 24"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" fill="currentColor" stroke="none"/></svg>' +
      '<div class="lcard-top">' +
        '<span class="lcard-num">L' + l.number + '</span>' +
        '<span class="lcard-chip ' + p.status + '">' +
          (p.status !== "not-started" ? '<span class="cdot"></span>' : '') + statusLabel(p.status) +
        '</span>' +
      '</div>' +
      '<p class="lcard-title">' + esc(l.title) + '</p>' +
      '<div class="lcard-foot">' +
        '<div class="lcard-track"><div class="lcard-bar" style="width:' + pct + '%"></div></div>' +
        '<span class="lcard-pct">' + pct + '%</span>' +
      '</div>';
    return a;
  }

  function renderResume() {
    var card = $("#resumeCard");
    var num = state.lastLesson;
    if (!num || !DATA.byNumber[num]) { card.hidden = true; return; }
    var l = DATA.byNumber[num], p = prog(num);
    card.hidden = false;
    $("#resumeTitle").textContent = "Lesson " + num + ": " + l.title;
    $("#resumeFill").style.width = Math.round((p.pct || 0) * 100) + "%";
    $("#resumeBtn").onclick = function () { location.hash = "#/lesson/" + num; };
  }

  function renderOverall() {
    var done = countDone(), total = DATA.lessons.length || 16;
    var pct = Math.round(done / total * 100);
    $("#overallPct").textContent = pct + "%";
    $("#statDone").textContent = done;
    $("#statProg").textContent = countProg();
    var circ = 2 * Math.PI * 52;
    var fg = $("#ringFg");
    fg.style.strokeDasharray = circ;
    fg.style.strokeDashoffset = circ * (1 - pct / 100);
  }

  /* ---------- Routing ---------- */
  function route() {
    var h = location.hash.replace(/^#\/?/, "");
    closeSearch();
    if (h.indexOf("lesson/") === 0) {
      var num = parseInt(h.split("/")[1], 10);
      if (DATA.byNumber[num]) return openLesson(num);
    }
    if (h === "bookmarks") return showView("bookmarks");
    showView("dashboard");
  }

  function showView(name) {
    ["dashboard", "lesson", "bookmarks"].forEach(function (v) {
      $("#view-" + v).hidden = (v !== name);
    });
    document.querySelectorAll(".side-link").forEach(function (a) {
      a.classList.toggle("active", a.dataset.route === name);
    });
    if (name !== "lesson") {
      document.querySelectorAll(".side-lesson").forEach(function (a) { a.classList.remove("active"); });
      var frame = $("#lessonFrame"); if (frame) frame.src = "about:blank";
    }
    if (name === "dashboard") { renderDashboard(); refreshSidebarStatus(); }
    if (name === "bookmarks") renderBookmarks();
    closeDrawer();
    $("#main").scrollTop = 0; window.scrollTo(0, 0);
  }

  /* ---------- Lesson view ---------- */
  var current = { number: null, ready: false };
  function openLesson(num) {
    var l = DATA.byNumber[num], d = DATA.domainById[l.domain];
    current = { number: num, ready: false };
    state.lastLesson = num; save();
    showView("lesson");

    document.querySelectorAll(".side-lesson").forEach(function (a) {
      a.classList.toggle("active", parseInt(a.dataset.lesson, 10) === num);
    });
    var openDomain = document.querySelector('.side-domain[data-domain="' + l.domain + '"]');
    if (openDomain) openDomain.classList.add("open");

    var chip = $("#lessonDomainChip");
    chip.textContent = "Domain " + d.id;
    chip.style.background = d.accent;
    $("#lessonTitle").textContent = "Lesson " + num + ": " + l.title;

    // prev / next by lesson order
    var idx = DATA.order.indexOf(num);
    var prevBtn = $("#lessonPrev"), nextBtn = $("#lessonNext");
    prevBtn.disabled = idx <= 0;
    nextBtn.disabled = idx >= DATA.order.length - 1;
    prevBtn.onclick = function () { if (idx > 0) location.hash = "#/lesson/" + DATA.order[idx - 1]; };
    nextBtn.onclick = function () { if (idx < DATA.order.length - 1) location.hash = "#/lesson/" + DATA.order[idx + 1]; };

    syncBookmarkBtn();
    var p = prog(num);
    $("#lessonProgressFill").style.width = Math.round((p.pct || 0) * 100) + "%";

    var loader = $("#frameLoader"); loader.style.display = "grid";
    var frame = $("#lessonFrame");
    frame.onload = function () {
      loader.style.display = "none";
      current.ready = true;
      // ask the lesson to restore the learner's position
      try {
        frame.contentWindow.postMessage({
          source: SHELL, kind: "restore",
          index: p.index || 0, scrollY: p.scrollY || 0
        }, "*");
      } catch (e) {}
      if (pendingGoto) { sendGoto(pendingGoto); pendingGoto = null; }
    };
    frame.src = l.file;
  }

  /* ---------- Progress messages from the lesson bridge ---------- */
  window.addEventListener("message", function (ev) {
    var d = ev.data;
    if (!d || d.source !== LESSON) return;
    if (current.number == null) return;
    if (d.kind !== "ready" && d.kind !== "progress") return;

    var num = current.number;
    var prev = state.progress[num] || {};
    var pct = Math.max(prev.pct || 0, d.pct || 0);          // progress only moves forward
    var status = d.status;
    if (prev.status === "complete") status = "complete";    // stay complete once earned

    var wasComplete = prev.status === "complete";
    state.progress[num] = {
      status: status, pct: pct,
      index: d.index || 0, label: d.label || prev.label || "",
      scrollY: d.scrollY || prev.scrollY || 0,
      updatedAt: Date.now()
    };
    save();

    $("#lessonProgressFill").style.width = Math.round(pct * 100) + "%";
    var dot = document.querySelector('.side-lesson[data-lesson="' + num + '"] .s-dot');
    if (dot) dot.className = "s-dot " + status;
    var sideDone = countDone();
    $("#sideProgressLabel").textContent = sideDone + " of " + DATA.lessons.length + " complete";
    $("#sideProgressFill").style.width = (sideDone / DATA.lessons.length * 100) + "%";

    if (!wasComplete && status === "complete") toast("Lesson " + num + " complete. Nice work.");
  });

  /* ---------- Bookmarks ---------- */
  function syncBookmarkBtn() {
    var btn = $("#bookmarkBtn");
    var on = state.bookmarks.some(function (b) { return b.lesson === current.number; });
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }
  $("#bookmarkBtn").addEventListener("click", function () {
    var num = current.number; if (num == null) return;
    var l = DATA.byNumber[num], p = prog(num);
    var existingIdx = state.bookmarks.findIndex(function (b) { return b.lesson === num; });
    if (existingIdx > -1) {
      state.bookmarks.splice(existingIdx, 1);
      toast("Bookmark removed");
    } else {
      state.bookmarks.unshift({
        lesson: num, label: p.label || ("Lesson " + num),
        sectionIndex: p.index || 0, createdAt: Date.now()
      });
      toast("Bookmarked" + (p.label ? ": " + p.label : ""));
    }
    save(); syncBookmarkBtn(); refreshBmCount();
  });
  function refreshBmCount() {
    var c = $("#bmCount");
    if (state.bookmarks.length) { c.hidden = false; c.textContent = state.bookmarks.length; }
    else c.hidden = true;
  }
  function renderBookmarks() {
    var list = $("#bookmarkList"), empty = $("#bookmarkEmpty");
    list.innerHTML = "";
    if (!state.bookmarks.length) { empty.hidden = false; return; }
    empty.hidden = true;
    state.bookmarks.forEach(function (b, i) {
      var l = DATA.byNumber[b.lesson];
      var card = el("button", "bm-item");
      card.innerHTML =
        '<span class="bm-flag"><svg viewBox="0 0 24 24"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z"/></svg></span>' +
        '<span class="bm-body">' +
          '<span class="bm-where">Lesson ' + b.lesson + (l ? ' · ' + esc(shortDomain(DATA.domainById[l.domain].name)) : '') + '</span>' +
          '<span class="bm-label">' + esc(b.label || (l ? l.title : "Lesson")) + '</span>' +
        '</span>';
      card.addEventListener("click", function () {
        pendingGoto = b.label && b.label !== ("Lesson " + b.lesson) ? b.label : null;
        location.hash = "#/lesson/" + b.lesson;
      });
      var del = el("button", "bm-del");
      del.setAttribute("aria-label", "Remove bookmark");
      del.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>';
      del.addEventListener("click", function (e) {
        e.stopPropagation();
        state.bookmarks.splice(i, 1); save(); renderBookmarks(); refreshBmCount();
        if (current.number != null) syncBookmarkBtn();
        renderDashboard();
      });
      var wrap = el("div", "bm-item");
      wrap.style.padding = "0"; wrap.style.border = "none"; wrap.style.boxShadow = "none"; wrap.style.background = "none";
      wrap.appendChild(card); wrap.appendChild(del);
      list.appendChild(wrap);
    });
  }

  /* ---------- Search ---------- */
  var pendingGoto = null;
  var searchFocusIdx = -1, searchItems = [];
  var input = $("#searchInput"), panel = $("#searchPanel");

  function runSearch(q) {
    q = q.trim().toLowerCase();
    var results = $("#searchResults"), status = $("#searchStatus");
    if (q.length < 2) {
      panel.hidden = false; input.setAttribute("aria-expanded", "true");
      status.textContent = "Type at least two letters to search across all sixteen lessons.";
      results.innerHTML = ""; searchItems = []; return;
    }
    var hits = [];
    for (var i = 0; i < DATA.search.length && hits.length < 60; i++) {
      var e = DATA.search[i];
      if (e.h.toLowerCase().indexOf(q) > -1) hits.push(e);
    }
    panel.hidden = false; input.setAttribute("aria-expanded", "true");
    results.innerHTML = ""; searchItems = []; searchFocusIdx = -1;

    if (!hits.length) {
      status.textContent = '';
      results.innerHTML = '<div class="sr-empty">No matches for "' + esc(q) + '". Try a different term.</div>';
      return;
    }
    status.textContent = hits.length + ' result' + (hits.length > 1 ? "s" : "") + ' across your lessons';

    var byLesson = {};
    hits.forEach(function (h) { (byLesson[h.l] = byLesson[h.l] || []).push(h); });
    Object.keys(byLesson).sort(function (a, b) { return a - b; }).forEach(function (ln) {
      var l = DATA.byNumber[ln];
      var group = el("div", "sr-group");
      group.innerHTML = '<div class="sr-group-head"><span class="lnum">L' + ln + '</span>' +
        esc(l ? l.title : "Lesson " + ln) + '</div>';
      byLesson[ln].slice(0, 8).forEach(function (h) {
        var item = el("button", "sr-item");
        item.innerHTML =
          '<svg class="sr-ico" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>' +
          '<span>' + highlight(h.h, q) + '</span>' +
          '<span class="sr-kind">' + (h.k === "term" ? "term" : "section") + '</span>';
        item.addEventListener("click", function () {
          pendingGoto = h.h;
          closeSearch();
          location.hash = "#/lesson/" + h.l;
        });
        group.appendChild(item);
        searchItems.push(item);
      });
      results.appendChild(group);
    });
  }
  function highlight(text, q) {
    var i = text.toLowerCase().indexOf(q);
    if (i < 0) return esc(text);
    return esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length));
  }
  function sendGoto(text) {
    var frame = $("#lessonFrame");
    try { frame.contentWindow.postMessage({ source: SHELL, kind: "goto", text: text }, "*"); } catch (e) {}
  }
  function closeSearch() {
    panel.hidden = true; input.setAttribute("aria-expanded", "false");
  }
  var searchDebounce;
  input.addEventListener("input", function () {
    clearTimeout(searchDebounce);
    var v = input.value;
    searchDebounce = setTimeout(function () { runSearch(v); }, 120);
  });
  input.addEventListener("focus", function () { if (input.value.trim().length >= 2) runSearch(input.value); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { input.blur(); closeSearch(); input.value = ""; return; }
    if (!searchItems.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); moveSearch(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveSearch(-1); }
    else if (e.key === "Enter") {
      e.preventDefault();
      (searchItems[searchFocusIdx] || searchItems[0]).click();
    }
  });
  function moveSearch(dir) {
    if (searchFocusIdx > -1 && searchItems[searchFocusIdx]) searchItems[searchFocusIdx].classList.remove("kfocus");
    searchFocusIdx = (searchFocusIdx + dir + searchItems.length) % searchItems.length;
    var it = searchItems[searchFocusIdx];
    it.classList.add("kfocus"); it.scrollIntoView({ block: "nearest" });
  }
  document.addEventListener("click", function (e) {
    if (!panel.hidden && !panel.contains(e.target) && !$(".topbar-search").contains(e.target)) closeSearch();
  });

  /* ---------- Theme ---------- */
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.theme);
    $("#themeToggle").setAttribute("aria-label",
      state.theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", state.theme === "dark" ? "#08111B" : "#0E2238");
  }
  $("#themeToggle").addEventListener("click", function () {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme(); save();
  });

  /* ---------- Drawer (mobile sidebar) ---------- */
  function openDrawer() { $("#sidebar").classList.add("open"); $("#scrim").hidden = false; $("#menuToggle").setAttribute("aria-expanded", "true"); }
  function closeDrawer() { $("#sidebar").classList.remove("open"); $("#scrim").hidden = true; $("#menuToggle").setAttribute("aria-expanded", "false"); }
  $("#menuToggle").addEventListener("click", function () {
    $("#sidebar").classList.contains("open") ? closeDrawer() : openDrawer();
  });
  $("#scrim").addEventListener("click", closeDrawer);
  document.querySelector(".sidebar").addEventListener("click", function (e) {
    if (e.target.closest(".side-link, .side-lesson")) closeDrawer();
  });

  /* ---------- Keyboard shortcut: "/" focuses search ---------- */
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== input &&
        !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "")) {
      e.preventDefault(); input.focus();
    }
  });

  /* ---------- PWA: install + service worker ---------- */
  var deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); deferredPrompt = e;
    $("#installBtn").hidden = false;
  });
  $("#installBtn").addEventListener("click", function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.finally(function () {
      deferredPrompt = null; $("#installBtn").hidden = true;
    });
  });
  window.addEventListener("appinstalled", function () {
    $("#installBtn").hidden = true; toast("Installed. You can now open the Hub from your apps.");
  });
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  /* ---------- Init ---------- */
  window.addEventListener("hashchange", route);
  applyTheme();
  refreshBmCount();
  boot();
})();
