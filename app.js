(function () {
  const storageKey = "boston-lawbook-items-v3";
  const legacyStorageKey = "boston-lawbook-items";
  const legacyStorageKeyV2 = "boston-lawbook-items-v2";
  const favoritesKey = "boston-lawbook-favorites";

  const state = {
    items: readItems(),
    sources: window.BOSTON_SOURCES || [],
    favorites: new Set(JSON.parse(localStorage.getItem(favoritesKey) || "[]")),
    activeTab: "Все",
    quick: "",
    query: ""
  };

  const els = {
    search: document.querySelector("#searchInput"),
    tabs: document.querySelector("#tabs"),
    chips: document.querySelector("#quickChips"),
    results: document.querySelector("#results"),
    countArticles: document.querySelector("#countArticles"),
    countSources: document.querySelector("#countSources"),
    countFavorites: document.querySelector("#countFavorites"),
    detailSheet: document.querySelector("#detailSheet"),
    detailClose: document.querySelector("#detailClose"),
    detailCode: document.querySelector("#detailCode"),
    detailTitle: document.querySelector("#detailTitle"),
    detailArticle: document.querySelector("#detailArticle"),
    detailUpdated: document.querySelector("#detailUpdated"),
    detailHierarchy: document.querySelector("#detailHierarchy"),
    detailText: document.querySelector("#detailText"),
    detailPenalty: document.querySelector("#detailPenalty"),
    detailSource: document.querySelector("#detailSource"),
    importOpen: document.querySelector("#importOpen"),
    importDialog: document.querySelector("#importDialog"),
    importTitle: document.querySelector("#importTitle"),
    importCategory: document.querySelector("#importCategory"),
    importSource: document.querySelector("#importSource"),
    importText: document.querySelector("#importText"),
    importSave: document.querySelector("#importSave"),
    clearLocal: document.querySelector("#clearLocal")
  };

  const quickFilters = [
    { label: "Штраф", value: "штраф" },
    { label: "Задержание", value: "задержание" },
    { label: "Лишение", value: "лишение" },
    { label: "Избранное", value: "favorite" }
  ];

  init();

  function init() {
    localStorage.removeItem(legacyStorageKey);
    localStorage.removeItem(legacyStorageKeyV2);
    renderTabs();
    renderChips();
    render();
    bindEvents();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  }

  function readItems() {
    const saved = localStorage.getItem(storageKey);
    if (saved) return JSON.parse(saved);
    return window.SEED_LAWS || [];
  }

  function saveItems() {
    localStorage.setItem(storageKey, JSON.stringify(state.items));
  }

  function saveFavorites() {
    localStorage.setItem(favoritesKey, JSON.stringify([...state.favorites]));
  }

  function bindEvents() {
    els.search.addEventListener("input", (event) => {
      state.query = event.target.value.trim();
      render();
    });

    els.detailClose.addEventListener("click", closeDetail);
    els.detailSheet.addEventListener("click", (event) => {
      if (event.target === els.detailSheet) closeDetail();
    });

    els.importOpen.addEventListener("click", () => els.importDialog.showModal());
    els.importSave.addEventListener("click", importText);
    els.clearLocal.addEventListener("click", () => {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(legacyStorageKey);
      state.items = [];
      state.activeTab = "Источники";
      renderTabs();
      render();
      els.importDialog.close();
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDetail();
    });
  }

  function renderTabs() {
    const lawCategories = [...new Set(state.items.map((item) => item.category))];
    const categories = ["Все", ...lawCategories, "Избранное", "Источники"];
    if (!categories.includes(state.activeTab)) state.activeTab = "Все";

    els.tabs.innerHTML = categories
      .map(
        (category) =>
          `<button class="tab" type="button" aria-selected="${category === state.activeTab}" data-tab="${escapeAttr(category)}">${escapeHtml(category)}</button>`
      )
      .join("");

    els.tabs.querySelectorAll(".tab").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeTab = button.dataset.tab;
        renderTabs();
        render();
      });
    });
  }

  function renderChips() {
    els.chips.innerHTML = quickFilters
      .map(
        (filter) =>
          `<button class="chip" type="button" data-filter="${filter.value}" aria-pressed="${filter.value === state.quick}">${filter.label}</button>`
      )
      .join("");

    els.chips.querySelectorAll(".chip").forEach((button) => {
      button.classList.toggle("active", button.dataset.filter === state.quick);
      button.addEventListener("click", () => {
        state.quick = state.quick === button.dataset.filter ? "" : button.dataset.filter;
        renderChips();
        render();
      });
    });
  }

  function render() {
    els.countArticles.textContent = String(state.items.length);
    els.countSources.textContent = String(new Set([...state.items.map((item) => item.codeTitle), ...state.sources.map((item) => item.title)]).size);
    els.countFavorites.textContent = String(state.favorites.size);

    if (state.activeTab === "Источники") {
      renderSources();
      return;
    }

    const items = getFilteredItems();
    if (!items.length) {
      els.results.innerHTML = `
        <div class="empty-state">
          База законки пока пустая. Нажми + и вставь текст темы форума, либо импортируй JSON, созданный извлекателем.
        </div>
      `;
      return;
    }

    els.results.innerHTML = items.map(renderCard).join("");
    els.results.querySelectorAll(".law-card").forEach((card) => {
      card.addEventListener("click", () => openDetail(card.dataset.id));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") openDetail(card.dataset.id);
      });
    });

    els.results.querySelectorAll(".favorite").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleFavorite(button.dataset.id);
      });
    });
  }

  function renderSources() {
    const query = normalize(state.query);
    const sources = state.sources.filter((source) => {
      if (!query) return true;
      return normalize([source.title, source.category, source.url, source.note].join(" ")).includes(query);
    });

    els.results.innerHTML = sources
      .map(
        (source) => `
          <article class="law-card source-card">
            <div class="card-head">
              <div>
                <div class="law-code">${escapeHtml(source.category)}</div>
                <h3 class="law-title">${escapeHtml(source.title)}</h3>
              </div>
              <a class="favorite source-open" href="${escapeAttr(source.url)}" target="_blank" rel="noreferrer" title="Открыть">↗</a>
            </div>
            <p class="law-text">${escapeHtml(source.note)}</p>
            <div class="article-pill">${escapeHtml(source.url.replace("https://forum.majestic-rp.ru/", ""))}</div>
          </article>
        `
      )
      .join("");
  }

  function getFilteredItems() {
    const query = normalize(state.query);
    return state.items
      .filter((item) => state.activeTab === "Все" || item.category === state.activeTab || (state.activeTab === "Избранное" && state.favorites.has(item.id)))
      .filter((item) => {
        if (!state.quick) return true;
        if (state.quick === "favorite") return state.favorites.has(item.id);
        return searchable(item).includes(state.quick);
      })
      .filter((item) => {
        if (!query) return true;
        return searchable(item).includes(query) || normalize(item.articleNumber).replace("статья ", "") === query;
      })
      .sort((a, b) => score(b, query) - score(a, query) || a.codeTitle.localeCompare(b.codeTitle, "ru"));
  }

  function searchable(item) {
    return normalize([item.articleNumber, item.title, item.text, item.penalty, item.codeTitle, item.category, ...(item.tags || [])].join(" "));
  }

  function score(item, query) {
    if (!query) return state.favorites.has(item.id) ? 2 : 1;
    const article = normalize(item.articleNumber).replace("статья ", "");
    if (article === query) return 100;
    if (article.startsWith(query)) return 70;
    if (normalize(item.title).includes(query)) return 40;
    if (normalize(item.penalty).includes(query)) return 25;
    return searchable(item).includes(query) ? 10 : 0;
  }

  function renderCard(item) {
    const favorite = state.favorites.has(item.id) ? "★" : "☆";
    return `
      <article class="law-card" tabindex="0" role="button" data-id="${escapeAttr(item.id)}">
        <div class="card-head">
          <div>
            <div class="law-code">${escapeHtml(item.codeTitle)}</div>
            <h3 class="law-title">${escapeHtml(item.title)}</h3>
          </div>
          <button class="favorite" type="button" data-id="${escapeAttr(item.id)}" title="В избранное">${favorite}</button>
        </div>
        <div class="article-pill">${escapeHtml(item.articleNumber)}</div>
        ${item.chapter ? `<div class="hierarchy">${escapeHtml(item.chapter)}</div>` : ""}
        <p class="law-text">${escapeHtml(item.text)}</p>
        <div class="penalty">${escapeHtml(item.penalty)}</div>
      </article>
    `;
  }

  function openDetail(id) {
    const item = state.items.find((entry) => entry.id === id);
    if (!item) return;

    els.detailCode.textContent = `${item.category} / ${item.codeTitle}`;
    els.detailTitle.textContent = item.title;
    els.detailArticle.textContent = item.articleNumber;
    els.detailUpdated.textContent = `Обновлено: ${item.updatedAt || "не указано"}`;
    els.detailHierarchy.textContent = [item.section, item.chapter].filter(Boolean).join(" / ");
    els.detailHierarchy.style.display = els.detailHierarchy.textContent ? "inline-flex" : "none";
    els.detailText.textContent = item.text;
    els.detailPenalty.textContent = item.penalty;
    els.detailSource.href = item.source || "#";
    els.detailSource.style.display = item.source ? "inline-flex" : "none";
    els.detailSheet.classList.add("open");
    els.detailSheet.setAttribute("aria-hidden", "false");
  }

  function closeDetail() {
    els.detailSheet.classList.remove("open");
    els.detailSheet.setAttribute("aria-hidden", "true");
  }

  function toggleFavorite(id) {
    if (state.favorites.has(id)) state.favorites.delete(id);
    else state.favorites.add(id);
    saveFavorites();
    render();
  }

  function importText() {
    const title = els.importTitle.value.trim() || "Импортированный раздел";
    const category = els.importCategory.value;
    const source = els.importSource.value.trim();
    const text = els.importText.value.trim();
    if (!text) return;

    const parsed = parseInput(text, title, category, source);
    state.items = [
      ...state.items.filter((item) => !(item.codeTitle === title && item.source === source && item.id.startsWith("import-"))),
      ...parsed
    ];
    saveItems();
    state.activeTab = category;
    renderTabs();
    render();
    els.importDialog.close();
    els.importTitle.value = "";
    els.importSource.value = "";
    els.importText.value = "";
  }

  function parseInput(text, codeTitle, category, source) {
    const trimmed = text.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const data = JSON.parse(trimmed);
        if (!Array.isArray(data) && typeof data.text === "string") {
          return parseArticles(
            data.text,
            data.title || codeTitle,
            data.category || category,
            data.source || source
          );
        }
        const records = Array.isArray(data) ? data : data.items || data.articles || [];
        return records.map((record, index) => normalizeImportedRecord(record, index, codeTitle, category, source));
      } catch (error) {
        return parseArticles(text, codeTitle, category, source);
      }
    }

    return parseArticles(text, codeTitle, category, source);
  }

  function normalizeImportedRecord(record, index, codeTitle, category, source) {
    const number = record.articleNumber || record.number || record.article || `Импорт ${index + 1}`;
    const title = record.title || record.heading || String(number);
    const body = record.text || record.body || record.content || "";
    const penalty = record.penalty || extractPenalty(body);
    return {
      id: record.id || `import-${Date.now()}-${index}`,
      category: record.category || category,
      codeTitle: record.codeTitle || record.code || codeTitle,
      articleNumber: String(number),
      title: String(title),
      text: String(body || title),
      penalty: String(penalty),
      source: record.source || source,
      updatedAt: record.updatedAt || new Date().toISOString().slice(0, 10),
      tags: record.tags || detectTags(`${title} ${body} ${penalty}`)
    };
  }

  function parseArticles(text, codeTitle, category, source) {
    const lines = text.replace(/\r/g, "").split("\n");
    const chunks = [];
    let current = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const match = line.match(/^(?:Статья\s*)?(\d+(?:\.\d+)*(?:\s*ч\.?\s*\d+)?(?:\s*\([A-ZА-Я/]+\))?)(?:[.\s|-]+)?(.+)?$/i);
      const isHeading = match && (line.toLowerCase().startsWith("статья") || line.length < 180);

      if (isHeading) {
        if (current) chunks.push(current);
        current = {
          number: line.toLowerCase().startsWith("статья") ? `Статья ${match[1]}` : match[1],
          title: (match[2] || "Без названия").trim(),
          body: []
        };
      } else if (current) {
        current.body.push(line);
      }
    }

    if (current) chunks.push(current);

    if (!chunks.length) {
      chunks.push({
        number: "Импорт",
        title: codeTitle,
        body: [text]
      });
    }

    return chunks.map((chunk, index) => {
      const body = chunk.body.join("\n");
      const penalty = extractPenalty(`${chunk.title}\n${body}`);
      return {
        id: `import-${Date.now()}-${index}`,
        category,
        codeTitle,
        articleNumber: chunk.number,
        title: chunk.title,
        text: body || chunk.title,
        penalty,
        source,
        updatedAt: new Date().toISOString().slice(0, 10),
        tags: detectTags(`${chunk.title} ${body} ${penalty}`)
      };
    });
  }

  function extractPenalty(text) {
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
    const line = lines.find((entry) => /наказани|штраф|лишени|залог|выговор|увольн|арест/i.test(entry));
    if (line) return line;
    return "Наказание не выделено автоматически.";
  }

  function detectTags(text) {
    const normalized = normalize(text);
    return ["штраф", "задержание", "обыск", "арест", "лишение", "залог", "увольнение", "выговор", "оружие", "транспорт"].filter((tag) =>
      normalized.includes(tag)
    );
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }
})();
