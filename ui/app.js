const STORAGE_KEY = "e33-field-manual-checks";

function loadChecks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveChecks(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}

const CARD_HEADING =
  /^(BOSS|MIME|WEAPON|PICTO|JOURNAL|MUSIC RECORD|LOST GESTRAL|PAINT CAGE|NEVRON QUEST|NEW ENEMY|OUTFIT|QUEST ITEM|MONOCO SKILL|OPTIONAL AREA|RETURN LATER)\b/i;

function headingClass(text) {
  if (text.startsWith("FROM:")) return "flag";
  if (CARD_HEADING.test(text)) return "card-title";
  return "";
}

function splitSession(markdown) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const session = [];
  const rest = [];
  let capturing = false;
  for (const line of lines) {
    if (/^## THIS SESSION\s*$/i.test(line.trim())) {
      capturing = true;
      continue;
    }
    if (capturing) {
      if (/^##\s+/.test(line) || /^---+$/.test(line.trim())) {
        capturing = false;
        rest.push(line);
        continue;
      }
      session.push(line);
      continue;
    }
    rest.push(line);
  }
  return { session, rest: rest.join("\n") };
}

function renderSession(sessionLines) {
  const items = sessionLines
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+/.test(line))
    .map((line) => `<li>${inline(line.replace(/^\d+\.\s+/, ""))}</li>`);
  if (!items.length) return "";
  return `<section class="session"><h2>This episode you</h2><ol class="session-list">${items.join("")}</ol></section>`;
}

function renderMarkdown(markdown, episodeId) {
  const { session, rest } = splitSession(markdown);
  const checks = loadChecks();
  const lines = rest.split("\n");
  const html = [renderSession(session)];
  let inTable = false;
  let listOpen = false;
  let checkIndex = 0;
  let leadingTitles = true;
  let inSession = false;

  const closeList = () => {
    if (listOpen) {
      html.push("</div>");
      listOpen = false;
    }
  };

  const closeTable = () => {
    if (inTable) {
      html.push("</tbody></table>");
      inTable = false;
    }
  };

  const closeSession = () => {
    if (inSession) {
      html.push("</ol></section>");
      inSession = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closeList();
      closeTable();
      continue;
    }

    if (line.startsWith("|")) {
      leadingTitles = false;
      closeSession();
      closeList();
      const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
      if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
      if (!inTable) {
        html.push("<table><thead><tr>");
        cells.forEach((cell) => html.push(`<th>${inline(cell)}</th>`));
        html.push("</tr></thead><tbody>");
        inTable = true;
      } else {
        html.push("<tr>");
        cells.forEach((cell) => html.push(`<td>${inline(cell)}</td>`));
        html.push("</tr>");
      }
      continue;
    }
    closeTable();

    if (/^---+$/.test(line.trim())) {
      leadingTitles = false;
      closeSession();
      closeList();
      html.push("<hr />");
      continue;
    }

    if (line.startsWith("# ⚠") || line.startsWith("# ⚠")) {
      leadingTitles = false;
      closeSession();
      closeList();
      html.push(`<div class="miss"><strong>${inline(line.replace(/^#\s+/, ""))}</strong></div>`);
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      const text = heading[2];
      if (leadingTitles && level === 1) {
        continue;
      }
      leadingTitles = false;
      if (/^THIS SESSION$/i.test(text)) {
        closeSession();
        inSession = true;
        html.push('<section class="session"><h2>This episode you</h2><ol class="session-list">');
        continue;
      }
      closeSession();
      const klass = headingClass(text);
      html.push(`<h${level}${klass ? ` class="${klass}"` : ""}>${inline(text)}</h${level}>`);
      continue;
    }

    if (line.trimStart().startsWith("☐") || line.trimStart().startsWith("- ☐") || line.trimStart().startsWith("* ")) {
      leadingTitles = false;
      closeSession();
      if (!listOpen) {
        html.push('<div class="checks">');
        listOpen = true;
      }
      const text = line.replace(/^\s*[-*]\s*/, "").replace(/^☐\s*/, "");
      if (line.includes("☐") || line.trimStart().startsWith("☐")) {
        const id = `${episodeId}:${checkIndex}`;
        checkIndex += 1;
        const done = Boolean(checks[id]);
        html.push(
          `<label class="check${done ? " done" : ""}"><input type="checkbox" data-check="${id}" ${done ? "checked" : ""} /><span>${inline(text)}</span></label>`,
        );
      } else {
        html.push(`<p>${inline(text)}</p>`);
      }
      continue;
    }

    leadingTitles = false;
    if (inSession && /^\d+\.\s+/.test(line.trim())) {
      html.push(`<li>${inline(line.trim().replace(/^\d+\.\s+/, ""))}</li>`);
      continue;
    }
    closeSession();
    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }

  closeSession();

  closeList();
  closeTable();
  return html.join("");
}

function countChecks(episodes) {
  return episodes.reduce((total, episode) => {
    const matches = episode.markdown.match(/☐/g);
    return total + (matches ? matches.length : 0);
  }, 0);
}

function updateMeter(episodes) {
  const checks = loadChecks();
  const total = countChecks(episodes);
  const done = Object.values(checks).filter(Boolean).length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  document.querySelector("#meter span").style.width = `${percent}%`;
  document.getElementById("meter-label").textContent = `${done} / ${total} checks · ${percent}%`;
}

function artPath(episode) {
  return `./art/${episode.id}.png`;
}

function shortTitle(title) {
  return title
    .replace(/^CLAIR OBSCUR: EXPEDITION 33$/i, "Master Index")
    .replace(/^Clair Obscur: Expedition 33 — /, "")
    .replace(/^Part \d+ — /, "");
}

function foldText(value) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function renderToc(episodes, currentId, query) {
  const needle = foldText(query.trim());
  const toc = document.getElementById("toc");
  toc.innerHTML = episodes
    .filter((episode) => !needle || foldText(episode.title).includes(needle) || String(episode.number).includes(needle))
    .map((episode) => {
      const label = episode.number === 0 ? "Index" : `Episode ${episode.number}`;
      return `<a href="#${episode.id}" class="${episode.id === currentId ? "active" : ""}"><img src="${artPath(episode)}" alt="" /><span><small>${label}</small>${escapeHtml(shortTitle(episode.title))}</span></a>`;
    })
    .join("");
}

function showEpisode(episodes, id) {
  const episode = episodes.find((item) => item.id === id) ?? episodes[0];
  const eyebrow = episode.number === 0 ? "Master index" : `Episode ${episode.number} of 30`;
  const title = shortTitle(episode.title);
  document.getElementById("eyebrow").textContent = eyebrow;
  document.getElementById("title").textContent = title;
  document.getElementById("lede").textContent =
    episode.number === 30
      ? "Finale only. If anything is still missing, go back to Episode 29."
      : episode.number === 0
        ? "Tomorrow comes. Thirty episodes. Everything possible before Lumière."
        : "Follow the checklists in order. Return Later items are already scheduled.";
  document.getElementById("hero-img").src = artPath(episode);
  document.getElementById("hero-img").alt = title;
  document.title = `${title} — Expedition 33 Field Manual`;
  document.getElementById("paper").innerHTML = renderMarkdown(episode.markdown, episode.id);

  const index = episodes.findIndex((item) => item.id === episode.id);
  const prev = episodes[index - 1];
  const next = episodes[index + 1];
  document.getElementById("prev").disabled = !prev;
  document.getElementById("next").disabled = !next;
  document.getElementById("prev").onclick = () => {
    if (prev) location.hash = prev.id;
  };
  document.getElementById("next").onclick = () => {
    if (next) location.hash = next.id;
  };

  renderToc(episodes, episode.id, document.getElementById("search").value);
  updateMeter(episodes);
  window.scrollTo({ top: 0, behavior: "instant" });
}

function boot() {
  const episodes = window.EPISODES;
  if (!episodes?.length) {
    document.getElementById("title").textContent = "Guide data missing";
    document.getElementById("paper").innerHTML =
      "<p>Run <code>node ui/build.mjs</code> from the project folder, then refresh this page.</p>";
    return;
  }

  const open = () => {
    const id = decodeURIComponent(location.hash.replace("#", "")) || episodes[0].id;
    showEpisode(episodes, id);
  };

  document.getElementById("search").addEventListener("input", (event) => {
    const current = decodeURIComponent(location.hash.replace("#", "")) || episodes[0].id;
    renderToc(episodes, current, event.target.value);
  });

  document.getElementById("paper").addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.dataset.check) return;
    const checks = loadChecks();
    checks[target.dataset.check] = target.checked;
    saveChecks(checks);
    target.closest("label")?.classList.toggle("done", target.checked);
    updateMeter(episodes);
  });

  window.addEventListener("hashchange", open);
  if (!location.hash) location.hash = episodes[0].id;
  else open();
}

boot();
