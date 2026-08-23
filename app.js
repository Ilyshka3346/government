(function () {
  const favoritesKey = "lawbook-favorites-v4";
  const projectKey = "lawbook-active-project-v4";

  const projects = window.PROJECTS || [
    { id: "boston", label: "Boston", shortLabel: "Boston", eyebrow: "Majestic RP", title: "Lawbook", accent: "#0e3f46" }
  ];

  const state = {
    allItems: window.SEED_LAWS || [],
    allSources: window.LAW_SOURCES || window.BOSTON_SOURCES || [],
    favorites: new Set(JSON.parse(localStorage.getItem(favoritesKey) || "[]")),
    activeProject: localStorage.getItem(projectKey) || projects[0].id,
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
    projectSwitch: document.querySelector("#projectSwitch"),
    activeProjectMark: document.querySelector("#activeProjectMark"),
    projectEyebrow: document.querySelector("#projectEyebrow"),
    projectTitle: document.querySelector("#projectTitle"),
    projectNote: document.querySelector("#projectNote"),
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
    themeMeta: document.querySelector('meta[name="theme-color"]')
  };

  const quickFilters = [
    { label: "Штраф", value: "штраф" },
    { label: "Задержание", value: "задержание" },
    { label: "Лишение", value: "лишение" },
    { label: "Суд", value: "суд" },
    { label: "Избранное", value: "favorite" }
  ];

  init();

  function init() {
    if (!projects.some((project) => project.id === state.activeProject)) {
      state.activeProject = projects[0].id;
    }

    renderProjectSwitch();
    renderTabs();
    renderChips();
    render();
    bindEvents();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
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

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDetail();
    });
  }

  function currentProject() {
    return projects.find((project) => project.id === state.activeProject) || projects[0];
  }

  function projectItems() {
    return state.allItems.filter((item) => item.project === state.activeProject);
  }

  function projectSources() {
    return state.allSources.filter((source) => !source.project || source.project === state.activeProject);
  }

  function applyProjectTheme() {
    const project = currentProject();
    document.documentElement.style.setProperty("--accent", project.accent || "#0e3f46");
    document.documentElement.dataset.project = project.id;
    if (els.themeMeta) els.themeMeta.setAttribute("content", project.accent || "#0e3f46");
    els.projectEyebrow.textContent = project.eyebrow || "Majestic RP";
    els.projectTitle.textContent = project.title || project.label;
    els.projectNote.textContent = project.note || "";
    els.search.placeholder = `Поиск в ${project.label}: статья, наказание или описание`;
    els.activeProjectMark.innerHTML = project.id === "russia"
      ? `<img src="./russia-online-logo.png" alt="" />`
      : `<span>B</span>`;
  }

  function renderProjectSwitch() {
    applyProjectTheme();
    els.projectSwitch.innerHTML = projects
      .map(
        (project) => `
          <button class="project-button" type="button" aria-pressed="${project.id === state.activeProject}" data-project="${escapeAttr(project.id)}">
            ${project.id === "russia" ? `<img src="./russia-online-logo.png" alt="" />` : `<span class="project-letter">B</span>`}
            <span>${escapeHtml(project.shortLabel || project.label)}</span>
          </button>
        `
      )
      .join("");

    els.projectSwitch.querySelectorAll(".project-button").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeProject = button.dataset.project;
        state.activeTab = "Все";
        localStorage.setItem(projectKey, state.activeProject);
        renderProjectSwitch();
        renderTabs();
        render();
      });
    });
  }

  function renderTabs() {
    const lawCategories = [...new Set(projectItems().map((item) => item.category))];
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
    applyProjectTheme();
    const items = projectItems();
    const sources = projectSources();
    els.countArticles.textContent = String(items.length);
    els.countSources.textContent = String(new Set([...items.map((item) => item.codeTitle), ...sources.map((item) => item.title)]).size);
    els.countFavorites.textContent = String(items.filter((item) => state.favorites.has(item.id)).length);

    if (state.activeTab === "Источники") {
      renderSources();
      return;
    }

    const filtered = getFilteredItems(items);
    if (!filtered.length) {
      els.results.innerHTML = `<div class="empty-state">Ничего не найдено в проекте ${escapeHtml(currentProject().label)}.</div>`;
      return;
    }

    els.results.innerHTML = filtered.map(renderCard).join("");
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
    const sources = projectSources().filter((source) => {
      if (!query) return true;
      return normalize([source.title, source.category, source.url, source.note].join(" ")).includes(query);
    });

    els.results.innerHTML = sources
      .map((source) => {
        const open = source.url
          ? `<a class="favorite source-open" href="${escapeAttr(source.url)}" target="_blank" rel="noreferrer" title="Открыть">↗</a>`
          : `<span class="favorite source-open muted-source">•</span>`;
        return `
          <article class="law-card source-card">
            <div class="card-head">
              <div>
                <div class="law-code">${escapeHtml(source.category)}</div>
                <h3 class="law-title">${escapeHtml(source.title)}</h3>
              </div>
              ${open}
            </div>
            <p class="law-text">${escapeHtml(source.note)}</p>
            <div class="article-pill">${escapeHtml(source.url || "локальный источник")}</div>
          </article>
        `;
      })
      .join("");
  }

  function getFilteredItems(items) {
    const query = normalize(state.query);
    return items
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
    return normalize([item.articleNumber, item.title, item.text, item.penalty, item.codeTitle, item.category, item.chapter, item.section, ...(item.tags || [])].join(" "));
  }

  function score(item, query) {
    if (!query) return state.favorites.has(item.id) ? 2 : 1;
    const article = normalize(item.articleNumber).replace("статья ", "");
    if (article === query) return 100;
    if (article.startsWith(query)) return 70;
    if (normalize(item.title).includes(query)) return 45;
    if (normalize(item.codeTitle).includes(query)) return 35;
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
    const item = state.allItems.find((entry) => entry.id === id);
    if (!item) return;

    els.detailCode.textContent = `${currentProject().label} / ${item.category} / ${item.codeTitle}`;
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
    localStorage.setItem(favoritesKey, JSON.stringify([...state.favorites]));
    render();
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
