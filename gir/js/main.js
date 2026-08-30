/* ============================================================
   GIR Décor — main.js
   Vanilla JS; framework/jQuery yok. Tüm etkileşimler:
   tema switcher · off-canvas menü · arama · sepet (localStorage +
   drawer) · filtreler (fiyat slider, checkbox) · sıralama ·
   sayfalama · galeri + lightbox · sekmeler · adet · cookie bar.
   ============================================================ */
(function () {
  "use strict";

  var CFG = window.GIR_CONFIG || { storageKeys: {}, themes: [], defaultTheme: "navy-gold" };
  var I18N = window.GIR_I18N;
  var PAGE = window.__GIR_PAGE__ || { lang: "fr", root: "./", products: {} };
  var t = I18N.t;
  var fmt = I18N.formatPrice;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function store(key, value) {
    try {
      if (arguments.length === 2) { localStorage.setItem(key, JSON.stringify(value)); return value; }
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) { return null; }
  }

  /* ---------- Toast ---------- */
  var toastEl = null;
  var toastTimer = null;
  function toast(message) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add("toast--visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("toast--visible"); }, 2200);
  }

  /* ---------- Tema switcher (#dev-theme-switcher, silinebilir) ---------- */
  (function themes() {
    var select = $("#dev-theme-switcher select");
    var saved = store(CFG.storageKeys.theme);
    if (saved && CFG.themes.indexOf(saved) !== -1) {
      document.documentElement.setAttribute("data-theme", saved);
    }
    if (!select) { return; }
    select.value = document.documentElement.getAttribute("data-theme") || CFG.defaultTheme;
    select.addEventListener("change", function () {
      document.documentElement.setAttribute("data-theme", select.value);
      store(CFG.storageKeys.theme, select.value);
    });
  })();

  /* ---------- Overlay (menü + sepet + filtre ortak) ---------- */
  var overlay = $(".js-overlay");
  var overlayClosers = [];
  function refreshOverlay() {
    if (!overlay) { return; }
    overlay.classList.toggle("overlay--visible", overlayClosers.length > 0);
  }
  function overlayBind(closeFn) {
    overlayClosers.push(closeFn);
    refreshOverlay();
  }
  function overlayRelease(closeFn) {
    overlayClosers = overlayClosers.filter(function (fn) { return fn !== closeFn; });
    refreshOverlay();
  }
  if (overlay) {
    overlay.addEventListener("click", function () {
      overlayClosers.slice().forEach(function (fn) { fn(); });
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlayClosers.length) {
      overlayClosers.slice().forEach(function (fn) { fn(); });
    }
  });

  /* Basit drawer fabrikası */
  function drawer(rootEl, openClass, openers, closers, opts) {
    if (!rootEl) { return { open: function () {}, close: function () {} }; }
    var hideWhenClosed = !opts || opts.hideWhenClosed !== false;
    var lastFocus = null;
    function close() {
      rootEl.classList.remove(openClass);
      if (hideWhenClosed) { rootEl.inert = true; }
      overlayRelease(close);
      if (lastFocus) { lastFocus.focus(); lastFocus = null; }
    }
    function open() {
      lastFocus = document.activeElement;
      rootEl.classList.add(openClass);
      rootEl.inert = false;
      overlayBind(close);
      var target = rootEl.querySelector("button, a, input, select");
      if (target) { target.focus(); }
    }
    openers.forEach(function (btn) { btn && btn.addEventListener("click", function (e) { e.preventDefault(); open(); }); });
    closers.forEach(function (btn) { btn && btn.addEventListener("click", close); });
    return { open: open, close: close };
  }

  /* ---------- Off-canvas menü ---------- */
  drawer($(".js-offcanvas"), "offcanvas--open", [$(".js-menu-open")], [$(".js-menu-close")]);

  /* ---------- Masaüstü alt menü (dokunmatik/klavye) ---------- */
  $$(".main-nav__item--has-sub").forEach(function (item) {
    var toggle = item.querySelector(".js-submenu-toggle");
    if (!toggle) { return; }
    toggle.addEventListener("click", function (e) {
      e.preventDefault();
      var open = item.classList.toggle("main-nav__item--open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", function (e) {
      if (!item.contains(e.target)) {
        item.classList.remove("main-nav__item--open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  });

  /* ---------- Arama ---------- */
  (function search() {
    var form = $(".js-search-form");
    if (!form) { return; }
    var input = form.querySelector("input[type='search']");
    var results = $(".js-search-results");
    var slugs = Object.keys(PAGE.products);

    function hide() { results.hidden = true; results.innerHTML = ""; }
    function run() {
      var q = input.value.trim().toLowerCase();
      if (q.length < 2) { hide(); return; }
      var hits = slugs.filter(function (slug) {
        var p = PAGE.products[slug];
        return (p.name + " " + p.sku).toLowerCase().indexOf(q) !== -1;
      });
      results.innerHTML = "";
      if (!hits.length) {
        var empty = document.createElement("p");
        empty.className = "header-search__empty";
        empty.textContent = t("search.noResults", { query: input.value.trim() });
        results.appendChild(empty);
      } else {
        hits.forEach(function (slug) {
          var p = PAGE.products[slug];
          var a = document.createElement("a");
          a.className = "header-search__result";
          a.href = p.url;
          var img = document.createElement("img");
          img.className = "header-search__result-img";
          img.src = p.image; img.alt = ""; img.width = 44; img.height = 44; img.loading = "lazy";
          var name = document.createElement("span");
          name.textContent = p.name;
          var price = document.createElement("span");
          price.className = "header-search__result-price";
          price.textContent = fmt(p.price);
          a.appendChild(img); a.appendChild(name); a.appendChild(price);
          results.appendChild(a);
        });
      }
      results.hidden = false;
    }
    input.addEventListener("input", run);
    form.addEventListener("submit", function (e) { e.preventDefault(); run(); });
    document.addEventListener("click", function (e) { if (!form.contains(e.target)) { hide(); } });
    input.addEventListener("keydown", function (e) { if (e.key === "Escape") { hide(); } });
  })();

  /* ---------- Sepet ---------- */
  var cart = {
    read: function () { return store(CFG.storageKeys.cart) || []; },
    write: function (items) { store(CFG.storageKeys.cart, items); cart.render(); },
    add: function (slug, qty) {
      var items = cart.read();
      var hit = items.filter(function (it) { return it.slug === slug; })[0];
      if (hit) { hit.qty += qty; } else { items.push({ slug: slug, qty: qty }); }
      cart.write(items);
      toast(t("product.addedToCart"));
    },
    remove: function (slug) {
      cart.write(cart.read().filter(function (it) { return it.slug !== slug; }));
    },
    count: function () {
      return cart.read().reduce(function (sum, it) { return sum + it.qty; }, 0);
    },
    subtotal: function () {
      return cart.read().reduce(function (sum, it) {
        var p = PAGE.products[it.slug];
        return p ? sum + p.price * it.qty : sum;
      }, 0);
    },
    render: function () {
      $$(".js-cart-count").forEach(function (el) {
        var n = cart.count();
        el.textContent = String(n);
        el.hidden = n === 0;
      });
      var body = $(".js-cart-body");
      if (!body) { return; }
      var items = cart.read().filter(function (it) { return PAGE.products[it.slug]; });
      body.innerHTML = "";
      if (!items.length) {
        var wrap = document.createElement("div");
        wrap.className = "cart-drawer__empty";
        var msg = document.createElement("p");
        msg.textContent = t("cart.empty");
        var link = document.createElement("a");
        link.className = "btn btn--primary";
        link.href = PAGE.categoryUrl;
        link.textContent = t("cart.emptyCta");
        wrap.appendChild(msg); wrap.appendChild(link);
        body.appendChild(wrap);
      } else {
        items.forEach(function (it) {
          var p = PAGE.products[it.slug];
          var row = document.createElement("div");
          row.className = "cart-item";
          var img = document.createElement("img");
          img.className = "cart-item__img"; img.src = p.image; img.alt = p.name;
          img.width = 64; img.height = 64; img.loading = "lazy";
          var mid = document.createElement("div");
          var name = document.createElement("p"); name.className = "cart-item__name"; name.textContent = p.name;
          var meta = document.createElement("p"); meta.className = "cart-item__meta";
          meta.textContent = it.qty + " × " + fmt(p.price) + " · " + t("cart.itemUnit");
          var rm = document.createElement("button");
          rm.type = "button"; rm.className = "cart-item__remove"; rm.textContent = t("cart.remove");
          rm.addEventListener("click", function () { cart.remove(it.slug); });
          mid.appendChild(name); mid.appendChild(meta); mid.appendChild(rm);
          var price = document.createElement("span");
          price.className = "cart-item__price"; price.textContent = fmt(p.price * it.qty);
          row.appendChild(img); row.appendChild(mid); row.appendChild(price);
          body.appendChild(row);
        });
      }
      var totalEl = $(".js-cart-subtotal");
      if (totalEl) { totalEl.textContent = fmt(cart.subtotal()); }
      var quote = $(".js-cart-quote");
      if (quote) {
        var lines = items.map(function (it) {
          var p = PAGE.products[it.slug];
          return "- " + p.name + " (" + p.sku + ") x " + it.qty;
        }).join("%0D%0A");
        quote.href = "mailto:" + PAGE.contactEmail +
          "?subject=" + encodeURIComponent(t("cart.quoteMailSubject")) +
          "&body=" + lines;
      }
    }
  };

  var cartDrawer = drawer($(".js-cart-drawer"), "cart-drawer--open", $$(".js-cart-open"), [$(".js-cart-close")]);
  $$("[data-add-to-cart]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var qtyInput = $(".js-qty-input");
      var qty = btn.hasAttribute("data-use-qty") && qtyInput ? Math.max(1, parseInt(qtyInput.value, 10) || 1) : 1;
      cart.add(btn.getAttribute("data-add-to-cart"), qty);
      cartDrawer.open();
    });
  });
  cart.render();

  /* ---------- Adet (qty) ---------- */
  (function qty() {
    var input = $(".js-qty-input");
    if (!input) { return; }
    $(".js-qty-minus").addEventListener("click", function () {
      input.value = Math.max(1, (parseInt(input.value, 10) || 1) - 1);
    });
    $(".js-qty-plus").addEventListener("click", function () {
      input.value = Math.max(1, (parseInt(input.value, 10) || 1) + 1);
    });
  })();

  /* ---------- Kategori: filtre + sıralama + sayfalama ---------- */
  (function shop() {
    var grid = $(".js-product-grid");
    if (!grid) { return; }
    var cards = $$(".product-card", grid);
    var sortSelect = $(".js-sort");
    var countEl = $(".js-result-count");
    var pagination = $(".js-pagination");
    var emptyEl = $(".js-shop-empty");
    var pageSize = parseInt(grid.getAttribute("data-page-size"), 10) || 12;
    var currentPage = 1;

    var minInput = $(".js-price-min");
    var maxInput = $(".js-price-max");
    var rangeFill = $(".js-price-range");
    var minLabel = $(".js-price-min-label");
    var maxLabel = $(".js-price-max-label");
    var bounds = { min: 0, max: 0 };
    if (minInput) {
      bounds.min = parseFloat(minInput.min);
      bounds.max = parseFloat(minInput.max);
    }

    function sliderValues() {
      if (!minInput) { return null; }
      var lo = Math.min(parseFloat(minInput.value), parseFloat(maxInput.value));
      var hi = Math.max(parseFloat(minInput.value), parseFloat(maxInput.value));
      return { lo: lo, hi: hi };
    }

    function paintSlider() {
      var v = sliderValues();
      if (!v) { return; }
      var span = bounds.max - bounds.min || 1;
      rangeFill.style.left = ((v.lo - bounds.min) / span) * 100 + "%";
      rangeFill.style.width = ((v.hi - v.lo) / span) * 100 + "%";
      minLabel.textContent = fmt(v.lo);
      maxLabel.textContent = fmt(v.hi);
    }

    function activeChecks(name) {
      return $$("input[data-filter='" + name + "']:checked").map(function (el) { return el.value; });
    }

    function apply() {
      var v = sliderValues();
      var finishes = activeChecks("finish");
      var thicknesses = activeChecks("thickness");

      var visible = cards.filter(function (card) {
        var price = parseFloat(card.getAttribute("data-price"));
        if (v && (price < v.lo || price > v.hi)) { return false; }
        if (finishes.length && finishes.indexOf(card.getAttribute("data-finish")) === -1) { return false; }
        if (thicknesses.length && thicknesses.indexOf(card.getAttribute("data-thickness")) === -1) { return false; }
        return true;
      });

      var mode = sortSelect ? sortSelect.value : "default";
      visible.sort(function (a, b) {
        var pa = parseFloat(a.getAttribute("data-price"));
        var pb = parseFloat(b.getAttribute("data-price"));
        switch (mode) {
          case "price-asc": return pa - pb;
          case "price-desc": return pb - pa;
          case "name-asc": return a.getAttribute("data-name").localeCompare(b.getAttribute("data-name"), PAGE.lang);
          case "newest": return (parseInt(b.getAttribute("data-new"), 10) || 0) - (parseInt(a.getAttribute("data-new"), 10) || 0);
          default: return (parseInt(a.getAttribute("data-index"), 10) || 0) - (parseInt(b.getAttribute("data-index"), 10) || 0);
        }
      });

      var pages = Math.max(1, Math.ceil(visible.length / pageSize));
      if (currentPage > pages) { currentPage = pages; }
      var start = (currentPage - 1) * pageSize;
      var shown = visible.slice(start, start + pageSize);

      cards.forEach(function (card) { card.remove(); });
      shown.forEach(function (card) { grid.appendChild(card); });

      if (emptyEl) { emptyEl.hidden = visible.length > 0; }
      if (countEl) {
        countEl.textContent = visible.length && shown.length < visible.length
          ? t("category.resultsCount", { shown: shown.length, total: visible.length })
          : t("category.resultsCountAll", { total: visible.length });
      }
      renderPagination(pages);
    }

    function renderPagination(pages) {
      if (!pagination) { return; }
      pagination.innerHTML = "";
      pagination.hidden = pages <= 1;
      if (pages <= 1) { return; }
      function btn(label, page, opts) {
        var el = document.createElement("button");
        el.type = "button";
        el.className = "pagination__btn" + (opts && opts.active ? " pagination__btn--active" : "");
        el.textContent = label;
        if (opts && opts.aria) { el.setAttribute("aria-label", opts.aria); }
        if (opts && opts.disabled) { el.setAttribute("disabled", ""); }
        if (opts && opts.active) { el.setAttribute("aria-current", "page"); }
        el.addEventListener("click", function () {
          currentPage = page;
          apply();
          grid.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        return el;
      }
      pagination.appendChild(btn("‹", Math.max(1, currentPage - 1), { aria: t("category.paginationPrev"), disabled: currentPage === 1 }));
      for (var i = 1; i <= pages; i++) {
        pagination.appendChild(btn(String(i), i, { active: i === currentPage, aria: t("category.paginationPage") + " " + i }));
      }
      pagination.appendChild(btn("›", Math.min(pages, currentPage + 1), { aria: t("category.paginationNext"), disabled: currentPage === pages }));
    }

    if (minInput) {
      [minInput, maxInput].forEach(function (input) {
        input.addEventListener("input", function () { paintSlider(); });
        input.addEventListener("change", function () { currentPage = 1; apply(); });
      });
      paintSlider();
    }
    $$("input[data-filter]").forEach(function (el) {
      el.addEventListener("change", function () { currentPage = 1; apply(); });
    });
    if (sortSelect) { sortSelect.addEventListener("change", function () { currentPage = 1; apply(); }); }
    var resetBtn = $(".js-filters-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        $$("input[data-filter]").forEach(function (el) { el.checked = false; });
        if (minInput) { minInput.value = minInput.min; maxInput.value = maxInput.max; paintSlider(); }
        if (sortSelect) { sortSelect.value = "default"; }
        currentPage = 1;
        apply();
      });
    }

    /* Filtre accordion */
    $$(".filter-group__toggle").forEach(function (toggleBtn) {
      toggleBtn.addEventListener("click", function () {
        var group = toggleBtn.closest(".filter-group");
        var collapsed = group.classList.toggle("filter-group--collapsed");
        toggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      });
    });

    /* Mobil filtre drawer */
    drawer($(".js-sidebar"), "sidebar--open", [$(".js-filters-open")], $$(".js-filters-close"), { hideWhenClosed: false });

    apply();
  })();

  /* ---------- Ürün galerisi + lightbox ---------- */
  (function gallery() {
    var main = $(".js-gallery-main");
    if (!main) { return; }
    var mainImg = $(".js-gallery-img");
    var thumbs = $$(".js-gallery-thumb");
    var current = 0;
    var sources = thumbs.map(function (thumbBtn) {
      return {
        full: thumbBtn.getAttribute("data-full"),
        srcset: thumbBtn.getAttribute("data-srcset") || "",
        alt: thumbBtn.getAttribute("data-alt") || ""
      };
    });

    function show(i) {
      current = (i + sources.length) % sources.length;
      mainImg.src = sources[current].full;
      if (sources[current].srcset) { mainImg.srcset = sources[current].srcset; } else { mainImg.removeAttribute("srcset"); }
      mainImg.alt = sources[current].alt;
      thumbs.forEach(function (thumbBtn, idx) {
        thumbBtn.classList.toggle("gallery__thumb--active", idx === current);
        thumbBtn.setAttribute("aria-pressed", idx === current ? "true" : "false");
      });
    }
    thumbs.forEach(function (thumbBtn, idx) {
      thumbBtn.addEventListener("click", function () { show(idx); });
    });

    /* Lightbox */
    var lb = $(".js-lightbox");
    var lbImg = $(".js-lightbox-img");
    function lbShow() { lbImg.src = sources[current].full; lbImg.alt = sources[current].alt; }
    function lbOpen() { lb.hidden = false; lbShow(); $(".js-lightbox-close").focus(); document.body.style.overflow = "hidden"; }
    function lbClose() { lb.hidden = true; document.body.style.overflow = ""; main.focus(); }
    main.addEventListener("click", lbOpen);
    $(".js-lightbox-close").addEventListener("click", lbClose);
    $(".js-lightbox-prev").addEventListener("click", function () { show(current - 1); lbShow(); });
    $(".js-lightbox-next").addEventListener("click", function () { show(current + 1); lbShow(); });
    lb.addEventListener("click", function (e) { if (e.target === lb) { lbClose(); } });
    document.addEventListener("keydown", function (e) {
      if (lb.hidden) { return; }
      if (e.key === "Escape") { lbClose(); }
      if (e.key === "ArrowLeft") { show(current - 1); lbShow(); }
      if (e.key === "ArrowRight") { show(current + 1); lbShow(); }
    });

    if (sources.length) { show(0); }
  })();

  /* ---------- Sekmeler ---------- */
  (function tabs() {
    var nav = $(".js-tabs");
    if (!nav) { return; }
    var buttons = $$(".tabs__btn", nav);
    var panels = buttons.map(function (btn) { return document.getElementById(btn.getAttribute("aria-controls")); });
    function activate(idx, focusBtn) {
      buttons.forEach(function (btn, i) {
        btn.classList.toggle("tabs__btn--active", i === idx);
        btn.setAttribute("aria-selected", i === idx ? "true" : "false");
        btn.tabIndex = i === idx ? 0 : -1;
        panels[i].hidden = i !== idx;
      });
      if (focusBtn) { buttons[idx].focus(); }
    }
    buttons.forEach(function (btn, idx) {
      btn.addEventListener("click", function () { activate(idx); });
      btn.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight") { activate((idx + 1) % buttons.length, true); }
        if (e.key === "ArrowLeft") { activate((idx - 1 + buttons.length) % buttons.length, true); }
      });
    });
  })();

  /* ---------- İletişim formu (mailto, demo) ---------- */
  (function contactForm() {
    var form = $(".js-contact-form");
    if (!form) { return; }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var get = function (name) { return (form.elements[name] && form.elements[name].value) || ""; };
      var body = get("message") + "\n\n— " + get("name") + " <" + get("email") + ">";
      window.location.href = "mailto:" + form.getAttribute("data-email") +
        "?subject=" + encodeURIComponent(get("subject")) +
        "&body=" + encodeURIComponent(body);
    });
  })();

  /* ---------- Cookie bar ---------- */
  (function cookieBar() {
    var bar = $(".js-cookie-bar");
    if (!bar) { return; }
    if (store(CFG.storageKeys.cookies)) { bar.hidden = true; return; }
    bar.hidden = false;
    $$(".js-cookie-choice", bar).forEach(function (btn) {
      btn.addEventListener("click", function () {
        store(CFG.storageKeys.cookies, btn.getAttribute("data-choice"));
        bar.hidden = true;
      });
    });
  })();
})();
