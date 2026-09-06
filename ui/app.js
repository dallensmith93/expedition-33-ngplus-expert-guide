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

function renderMarkdown(markdown, episodeId) {
  const checks = loadChecks();
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const html = [];
  let inTable = false;
  let listOpen = false;
  let checkIndex = 0;

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

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closeList();
      closeTable();
      continue;
    }

    if (line.startsWith("|")) {
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
      closeList();
      html.push("<hr />");
      continue;
    }

    if (line.startsWith("# ⚠") || line.startsWith("# ⚠")) {
      closeList();
      html.push(`<div class="miss"><strong>${inline(line.replace(/^#\s+/, ""))}</strong></div>`);
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (line.trimStart().startsWith("☐") || line.trimStart().startsWith("- ☐") || line.trimStart().startsWith("* ")) {
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

    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }

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

function renderToc(episodes, currentId, query) {
  const needle = query.trim().toLowerCase();
  const toc = document.getElementById("toc");
  toc.innerHTML = episodes
    .filter((episode) => !needle || episode.title.toLowerCase().includes(needle) || String(episode.number).includes(needle))
    .map((episode) => {
      const label = episode.number === 0 ? "Index" : `Episode ${episode.number}`;
      return `<a href="#${episode.id}" class="${episode.id === currentId ? "active" : ""}"><small>${label}</small>${escapeHtml(episode.title.replace(/^Clair Obscur: Expedition 33 — /, ""))}</a>`;
    })
    .join("");
}

function showEpisode(episodes, id) {
  const episode = episodes.find((item) => item.id === id) ?? episodes[0];
  const eyebrow = episode.number === 0 ? "Master index" : `Episode ${episode.number} of 30`;
  document.getElementById("eyebrow").textContent = eyebrow;
  document.getElementById("title").textContent = episode.title.replace(/^Clair Obscur: Expedition 33 — /, "");
  document.getElementById("lede").textContent =
    episode.number === 30
      ? "Finale only. If anything is still missing, go back to Episode 29."
      : "Follow the checklists in order. Return Later items are already scheduled.";
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
