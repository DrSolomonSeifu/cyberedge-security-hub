/* ============================================================================
   Learning Hub — Lesson Bridge
   Injected into each self-contained lesson portal. It never changes how a
   lesson looks or works; it only observes the lesson's own navigation and
   reports progress up to the Hub shell, and restores position on resume.
   Safe by design: everything is wrapped so a lesson keeps working even if
   any assumption here fails, and it does nothing when opened outside the Hub.
============================================================================ */
(function () {
  "use strict";
  if (window.self === window.top) return;            // only run inside the Hub
  var SHELL = "ceh-shell", LESSON = "ceh-lesson";

  var state = {
    nav: [],          // the lesson's own section-nav controls (tabs/pills)
    labels: [],       // human label per section
    count: 1,
    index: 0,         // current section
    maxIndex: 0,      // furthest section reached
    reviewVisited: false,
    pct: 0,
    status: "in-progress"
  };

  function clean(t) {
    return (t || "").replace(/\s+/g, " ").replace(/^[^\w(]+/, "").trim();
  }

  /* ---- Find the lesson's section navigation, whatever pattern it uses ---- */
  function findNav() {
    var containers = [
      ".tab-navigation", ".nav-tabs", ".nav-wrap .nav-tabs", "[role=tablist]",
      ".tabs", ".pills", ".nav", ".chiprow", ".qchips", ".tab-bar", ".tabbar"
    ];
    for (var i = 0; i < containers.length; i++) {
      var c = document.querySelector(containers[i]);
      if (!c) continue;
      var kids = Array.prototype.filter.call(
        c.querySelectorAll("button, a, .tab-btn, .nav-tab, .pill, .chip, [data-tab], [data-section]"),
        function (el) {
          // direct-ish children only, and must carry a short label
          var t = clean(el.textContent);
          return t && t.length <= 40;
        }
      );
      // de-dup nested matches, keep outermost clickable
      var uniq = [];
      kids.forEach(function (k) {
        if (!uniq.some(function (u) { return u.contains(k) || k.contains(u); })) uniq.push(k);
      });
      if (uniq.length >= 2 && uniq.length <= 12) return uniq;
    }
    return [];
  }

  function activeIndex() {
    for (var i = 0; i < state.nav.length; i++) {
      var el = state.nav[i];
      if (el.classList && (el.classList.contains("active") ||
          el.getAttribute("aria-selected") === "true")) return i;
    }
    return state.index;
  }

  /* ---- Progress: max of tab-progress and scroll-progress ---- */
  function scrollPct() {
    var d = document.documentElement, b = document.body;
    var h = Math.max(d.scrollHeight, b.scrollHeight) - window.innerHeight;
    if (h <= 0) return 0;
    return Math.min(1, (window.scrollY || d.scrollTop || 0) / h);
  }

  function recompute(report) {
    try {
      if (state.count > 1) {
        var ai = activeIndex();
        if (ai !== state.index) state.index = ai;
        if (state.index > state.maxIndex) state.maxIndex = state.index;
        var lbl = (state.labels[state.index] || "").toLowerCase();
        if (/review activit|review-activity|^review$/.test(lbl)) state.reviewVisited = true;
      }
      var tabPct = state.count > 1 ? (state.maxIndex + 1) / state.count : 0;
      state.pct = Math.max(state.pct, tabPct, scrollPct());

      if (state.pct >= 0.92 || (state.reviewVisited && state.pct >= 0.6) ||
          (state.count > 1 && state.maxIndex >= state.count - 1)) {
        state.status = "complete";
      } else if (state.pct > 0.02 || state.maxIndex > 0) {
        state.status = "in-progress";
      }
      if (report !== false) post("progress");
    } catch (e) {}
  }

  function post(kind) {
    try {
      window.parent.postMessage({
        source: LESSON, kind: kind,
        index: state.index, label: state.labels[state.index] || "",
        count: state.count, sections: state.labels,
        pct: Math.round(state.pct * 1000) / 1000,
        scrollY: window.scrollY || document.documentElement.scrollTop || 0,
        status: state.status, reviewVisited: state.reviewVisited
      }, "*");
    } catch (e) {}
  }

  /* ---- Resume + search deep-link, sent from the shell ---- */
  function activateOwningTab(node) {
    // if node lives inside a hidden tab-panel, click the nav control for it
    try {
      var panel = node.closest("section, .tab-content, .panel, [id]");
      while (panel) {
        var id = panel.id;
        if (id) {
          var ctrl = state.nav.find(function (n) {
            var dt = n.getAttribute && (n.getAttribute("data-tab") || n.getAttribute("data-section"));
            var oc = (n.getAttribute && n.getAttribute("onclick")) || "";
            return dt === id || oc.indexOf(id) > -1;
          });
          if (ctrl) { ctrl.click(); return; }
        }
        panel = panel.parentElement && panel.parentElement.closest("section, .tab-content, .panel, [id]");
      }
    } catch (e) {}
  }

  function onShellMessage(ev) {
    var d = ev.data;
    if (!d || d.source !== SHELL) return;
    try {
      if (d.kind === "restore") {
        if (typeof d.index === "number" && state.nav[d.index]) {
          state.nav[d.index].click();
          state.maxIndex = Math.max(state.maxIndex, d.index);
        }
        if (typeof d.scrollY === "number") {
          setTimeout(function () { window.scrollTo(0, d.scrollY); }, 90);
        }
        recompute(false); post("progress");
      } else if (d.kind === "goto" && d.text) {
        var q = String(d.text).toLowerCase();
        var hs = Array.prototype.slice.call(document.querySelectorAll("h1,h2,h3,h4,dt,.term"));
        var hit = hs.find(function (h) { return clean(h.textContent).toLowerCase().indexOf(q) > -1; });
        if (hit) {
          activateOwningTab(hit);
          setTimeout(function () { hit.scrollIntoView({ behavior: "smooth", block: "start" }); }, 120);
        }
      }
    } catch (e) {}
  }

  function init() {
    try {
      state.nav = findNav();
      state.count = state.nav.length || 1;
      state.labels = state.nav.map(function (n) { return clean(n.textContent); });
      if (state.count <= 1) state.labels = ["Lesson content"];
      state.index = activeIndex();
      state.maxIndex = state.index;

      // watch the lesson's own tab toggling
      if (state.count > 1) {
        var mo = new MutationObserver(function () { recompute(); });
        state.nav.forEach(function (n) {
          mo.observe(n, { attributes: true, attributeFilter: ["class", "aria-selected"] });
          n.addEventListener("click", function () { setTimeout(recompute, 40); });
        });
      }
      var ticking = false;
      window.addEventListener("scroll", function () {
        if (ticking) return; ticking = true;
        requestAnimationFrame(function () { recompute(); ticking = false; });
      }, { passive: true });

      window.addEventListener("message", onShellMessage);
      recompute(false);
      post("ready");
      setInterval(function () { recompute(); }, 4000); // gentle heartbeat
    } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
