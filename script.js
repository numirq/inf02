const CONFIG = {
  owner: "numirq",
  repo: "inf02",
  branch: "main",
};

const notesListElement = document.getElementById("notes-list");
const noteTitleElement = document.getElementById("note-title");
const noteContentElement = document.getElementById("note-content");
const topic = document.body.dataset.topic;
let availableNotes = [];
let contentRequestId = 0;

const classCrumb = document.querySelector("[data-class-crumb]");
const classSeparator = document.querySelector("[data-class-separator]");
const currentCrumb = document.querySelector(".breadcrumb-current");
const topicHeading = document.querySelector(".notes-list-panel h1");

if (currentCrumb && topicHeading) {
  currentCrumb.textContent = topicHeading.textContent.replace(/^notatki\s*/i, "").trim();
}

if (new URLSearchParams(window.location.search).get("year") === "3") {
  if (classCrumb) classCrumb.hidden = false;
  if (classSeparator) classSeparator.hidden = false;
}

if (topic && notesListElement && noteTitleElement && noteContentElement) {
  loadNotes(topic);
}

async function loadNotes(folderName) {
  renderMessage("wczytywanie notatek...");

  if (CONFIG.owner === "TWOJ_LOGIN_GITHUB" || CONFIG.repo === "TWOJE_REPO") {
    renderMessage("nie skonfigurowano repozytorium notatek.");
    return;
  }

  const apiUrl = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${folderName}?ref=${CONFIG.branch}`;

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`Błąd GitHub API: ${response.status}`);
    }

    const files = await response.json();
    const supportedExtensions = /\.(txt|md|sql|py|sh|bat|ps1|js|html|css|csv|xlsx|xls|docx|doc|pptx|ppt|jpg|jpeg|png|gif|webp|pdf)$/i;
    const noteFiles = files
      .filter((file) => supportedExtensions.test(file.name))
      .sort((first, second) => first.name.localeCompare(second.name, "pl"));
    const panelDescription = document.querySelector(".panel-description");

    if (noteFiles.length === 0) {
      panelDescription.textContent = "0 plików";
      renderMessage("brak notatek w tej kategorii.");
      return;
    }

    notesListElement.innerHTML = "";
    availableNotes = noteFiles;
    panelDescription.textContent = `${noteFiles.length} ${getFileCountLabel(noteFiles.length)}`;

    noteFiles.forEach((file, index) => {
      const listItem = document.createElement("li");
      const button = document.createElement("button");
      button.textContent = file.name;
      button.type = "button";

      button.addEventListener("click", () => {
        selectButton(button);
        loadNoteContent(file);
      });

      listItem.appendChild(button);
      notesListElement.appendChild(listItem);

      if (index === 0) {
        button.click();
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "nieznany błąd";
    renderMessage(`nie udało się pobrać listy plików. ${message}`);
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "nav-button";
    retry.textContent = "spróbuj ponownie";
    retry.addEventListener("click", () => loadNotes(folderName));
    noteContentElement.appendChild(retry);
  }
}

function getFileCountLabel(count) {
  if (count === 1) return "plik";
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14)) return "pliki";
  return "plików";
}

async function loadNoteContent(file) {
  const requestId = ++contentRequestId;
  noteTitleElement.textContent = file.name;
  noteContentElement.textContent = "wczytywanie...";

  const extension = (file.name.split(".").pop() || "").toLowerCase();

  if (["jpg", "jpeg", "png", "gif", "webp"].includes(extension)) {
    renderImage(file);
    return;
  }

  if (extension === "pdf") {
    renderPdf(file);
    return;
  }

  if (["xlsx", "xls", "docx", "doc", "pptx", "ppt"].includes(extension)) {
    renderDownloadFile(file);
    return;
  }

  try {
    const response = await fetch(file.download_url);

    if (!response.ok) {
      throw new Error(`blad pobierania pliku ${response.status}`);
    }

    const content = await response.text();
    if (requestId !== contentRequestId) return;
    if (extension === "csv") {
      renderCsvContent(content);
      return;
    }

    const relatedImage = findRelatedImage(file);
    if (extension === "md") {
      renderMarkdown(content, file);
      appendRelatedImage(relatedImage);
      return;
    }

    renderTextContent(content, relatedImage, extension);
  } catch (error) {
    if (requestId !== contentRequestId) return;
    const message = error instanceof Error ? error.message : "nieznany błąd";
    renderError(`nie udało się wczytać pliku. ${message}`);
  }
}

function renderImage(file) {
  noteContentElement.innerHTML = "";
  const image = document.createElement("img");
  image.src = file.download_url;
  image.alt = file.name;
  image.loading = "lazy";

  image.addEventListener("error", () => {
    renderError("nie udało się wyświetlić obrazu.");
  });

  noteContentElement.appendChild(image);
}

function renderPdf(file) {
  noteContentElement.innerHTML = "";

  const object = document.createElement("object");
  object.data = file.download_url;
  object.type = "application/pdf";

  const fallback = document.createElement("p");
  fallback.className = "note-meta";
  fallback.textContent = "jeśli podgląd nie działa, ";
  const link = document.createElement("a");
  link.href = file.download_url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "otwórz plik PDF";
  fallback.appendChild(link);
  fallback.appendChild(document.createTextNode("."));

  object.appendChild(fallback);
  noteContentElement.appendChild(object);
}

function renderDownloadFile(file) {
  noteContentElement.innerHTML = "";
  const message = document.createElement("p");
  message.className = "note-meta";
  message.textContent = "tego pliku nie można wyświetlić w podglądzie.";
  const link = document.createElement("a");
  link.className = "nav-button";
  link.href = file.download_url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "otwórz lub pobierz plik";
  noteContentElement.append(message, link);
}

function renderTextContent(content, relatedImage, extension = "txt") {
  if (topic === "linki") {
    renderLinkiContent(content);
    return;
  }

  if (extension === "txt") {
    renderPlainTextNote(content);
    appendRelatedImage(relatedImage);
    return;
  }

  noteContentElement.innerHTML = "";
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.textContent = content;
  pre.appendChild(code);
  if (["sql", "py", "sh", "bat", "ps1", "js", "html", "css"].includes(extension)) {
    pre.classList.add("code-block");
    code.className = `language-${extension}`;
    pre.dataset.language = extension;
  }
  noteContentElement.appendChild(pre);
  appendRelatedImage(relatedImage);
}

function renderPlainTextNote(content) {
  noteContentElement.innerHTML = "";
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  let index = 0;

  while (index < lines.length) {
    const currentLine = lines[index];
    const trimmed = currentLine.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const heading = trimmed.match(/^(?:#{2,6}\s*(.+)|#([^\s#].*))$/);
    if (heading) {
      appendPlainTextHeading((heading[1] || heading[2]).trim(), 2);
      index += 1;
      continue;
    }

    if (isPlainTextListItem(trimmed)) {
      const ordered = /^\d+[.)]\s+/.test(trimmed);
      const list = document.createElement(ordered ? "ol" : "ul");
      while (index < lines.length && isPlainTextListItem(lines[index].trim())) {
        const item = document.createElement("li");
        item.textContent = lines[index].trim().replace(/^(?:[-*+]|\u2022|\d+[.)])\s+/, "");
        list.appendChild(item);
        index += 1;
      }
      noteContentElement.appendChild(list);
      continue;
    }

    const paragraphLines = [currentLine];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(?:#{2,6}\s*\S|#[^\s#]\S*)/.test(lines[index].trim()) && !isPlainTextListItem(lines[index].trim())) {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    const paragraph = document.createElement("p");
    paragraph.textContent = paragraphLines.join("\n");
    noteContentElement.appendChild(paragraph);
  }
}

function appendPlainTextHeading(text, level) {
  const heading = document.createElement(level === 2 ? "h2" : "h3");
  heading.textContent = text;
  noteContentElement.appendChild(heading);
}

function isPlainTextListItem(line) {
  return /^(?:[-*+]|\u2022|\d+[.)])\s+/.test(line);
}

function appendRelatedImage(relatedImage) {
  if (relatedImage) {
    appendOpenButton(relatedImage.download_url, "otwórz zdjęcie w nowej karcie");

    const image = document.createElement("img");
    image.src = relatedImage.download_url;
    image.alt = relatedImage.name;
    image.loading = "lazy";
    image.addEventListener("error", () => {
      const error = document.createElement("p");
      error.className = "note-error";
      error.textContent = "nie udało się wyświetlić powiązanego zdjęcia.";
      image.replaceWith(error);
    });
    noteContentElement.appendChild(image);
  }
}

function renderMarkdown(content, sourceFile) {
  noteContentElement.innerHTML = "";
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const fence = trimmed.match(/^```([\w+-]*)\s*$/);
    if (fence) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      const pre = document.createElement("pre");
      pre.className = "code-block";
      if (fence[1]) pre.dataset.language = fence[1].toLowerCase();
      const code = document.createElement("code");
      code.textContent = codeLines.join("\n");
      pre.appendChild(code);
      noteContentElement.appendChild(pre);
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const element = document.createElement(`h${heading[1].length}`);
      appendInlineMarkdown(element, heading[2], sourceFile);
      noteContentElement.appendChild(element);
      index += 1;
      continue;
    }

    if (isMarkdownTableRow(trimmed) && index + 1 < lines.length && isMarkdownTableDivider(lines[index + 1])) {
      index = renderMarkdownTable(lines, index, sourceFile);
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quote = document.createElement("blockquote");
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        const paragraph = document.createElement("p");
        appendInlineMarkdown(paragraph, lines[index].replace(/^\s*>\s?/, ""), sourceFile);
        quote.appendChild(paragraph);
        index += 1;
      }
      noteContentElement.appendChild(quote);
      continue;
    }

    const listMatch = trimmed.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const ordered = /^\d/.test(listMatch[2]);
      const list = document.createElement(ordered ? "ol" : "ul");
      while (index < lines.length) {
        const itemMatch = lines[index].match(/^\s*(?:[-*+]|\d+\.)\s+(.+)$/);
        if (!itemMatch) break;
        const item = document.createElement("li");
        appendInlineMarkdown(item, itemMatch[1], sourceFile);
        list.appendChild(item);
        index += 1;
      }
      noteContentElement.appendChild(list);
      continue;
    }

    const paragraph = document.createElement("p");
    appendInlineMarkdown(paragraph, trimmed, sourceFile);
    noteContentElement.appendChild(paragraph);
    index += 1;
  }
}

function isMarkdownTableRow(line) {
  return line.includes("|");
}

function isMarkdownTableDivider(line) {
  const cells = splitMarkdownTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function splitMarkdownTableRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function renderMarkdownTable(lines, startIndex, sourceFile) {
  const headers = splitMarkdownTableRow(lines[startIndex]);
  const table = document.createElement("table");
  table.className = "markdown-table";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  headers.forEach((header) => {
    const cell = document.createElement("th");
    appendInlineMarkdown(cell, header, sourceFile);
    headerRow.appendChild(cell);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  let index = startIndex + 2;
  while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
    const row = document.createElement("tr");
    splitMarkdownTableRow(lines[index]).forEach((value, cellIndex) => {
      const cell = document.createElement("td");
      appendInlineMarkdown(cell, value, sourceFile);
      if (cellIndex < headers.length) row.appendChild(cell);
    });
    tbody.appendChild(row);
    index += 1;
  }
  table.appendChild(tbody);
  noteContentElement.appendChild(table);
  return index;
}

function appendInlineMarkdown(parent, text, sourceFile) {
  const tokenPattern = /(!?\[([^\]]*)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_)/g;
  let lastIndex = 0;
  let match;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parent.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    if (match[1].startsWith("!")) {
      const imageUrl = resolveMarkdownUrl(match[3], sourceFile.download_url, true);
      if (imageUrl) {
        const image = document.createElement("img");
        image.src = imageUrl;
        image.alt = match[2];
        image.loading = "lazy";
        image.addEventListener("error", () => image.replaceWith(document.createTextNode("nie udało się wczytać obrazka")));
        parent.appendChild(image);
      } else {
        parent.appendChild(document.createTextNode(match[2]));
      }
    } else if (match[1].startsWith("[")) {
      const href = resolveMarkdownUrl(match[3], sourceFile.download_url, false);
      if (href) {
        const link = document.createElement("a");
        link.href = href;
        link.textContent = match[2];
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        parent.appendChild(link);
      } else {
        parent.appendChild(document.createTextNode(match[2]));
      }
    } else if (match[4]) {
      const code = document.createElement("code");
      code.textContent = match[4];
      parent.appendChild(code);
    } else {
      const wrapper = document.createElement(match[5] || match[6] ? "strong" : "em");
      appendInlineMarkdown(wrapper, match[5] || match[6] || match[7] || match[8], sourceFile);
      parent.appendChild(wrapper);
    }
    lastIndex = tokenPattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parent.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

function resolveMarkdownUrl(value, sourceUrl, isImage) {
  try {
    const resolved = new URL(value, sourceUrl);
    const allowedProtocols = isImage ? ["https:"] : ["https:", "http:", "mailto:"];
    return allowedProtocols.includes(resolved.protocol) ? resolved.href : null;
  } catch {
    return null;
  }
}

function renderCsvContent(content) {
  const rows = parseCsv(content);
  noteContentElement.innerHTML = "";

  if (rows.length === 0) {
    noteContentElement.textContent = "plik csv jest pusty.";
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "csv-table-wrapper";
  const table = document.createElement("table");
  table.className = "csv-table";
  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");
  rows[0].forEach((value) => {
    const cell = document.createElement("th");
    cell.textContent = value;
    headerRow.appendChild(cell);
  });
  head.appendChild(headerRow);
  table.appendChild(head);

  const body = document.createElement("tbody");
  rows.slice(1).forEach((values) => {
    const row = document.createElement("tr");
    rows[0].forEach((_, index) => {
      const cell = document.createElement("td");
      cell.textContent = values[index] || "";
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
  table.appendChild(body);
  wrapper.appendChild(table);
  noteContentElement.appendChild(wrapper);
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const input = content.replace(/^\uFEFF/, "");
  const delimiter = detectCsvDelimiter(input);

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"' && quoted && input[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  row.push(cell);
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function detectCsvDelimiter(content) {
  const firstLine = content.split(/\r?\n/, 1)[0] || "";
  let quoted = false;
  let commas = 0;
  let semicolons = 0;

  for (let index = 0; index < firstLine.length; index += 1) {
    if (firstLine[index] === '"' && firstLine[index + 1] === '"' && quoted) {
      index += 1;
    } else if (firstLine[index] === '"') {
      quoted = !quoted;
    } else if (!quoted && firstLine[index] === ",") {
      commas += 1;
    } else if (!quoted && firstLine[index] === ";") {
      semicolons += 1;
    }
  }

  return semicolons > commas ? ";" : ",";
}

function findRelatedImage(textFile) {
  const textBaseName = textFile.name.replace(/\.[^.]+$/, "").toLocaleLowerCase("pl");
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp)$/i;

  return availableNotes.find((file) => {
    const imageBaseName = file.name.replace(/\.[^.]+$/, "").toLocaleLowerCase("pl");
    return imageExtensions.test(file.name) && imageBaseName === textBaseName;
  });
}

function appendOpenButton(url, label) {
  const actions = document.createElement("div");
  actions.className = "note-preview-actions";
  const link = document.createElement("a");
  link.className = "nav-button";
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  actions.appendChild(link);
  noteContentElement.appendChild(actions);
}

function renderLinkiContent(content) {
  noteContentElement.innerHTML = "";
  const lines = content.split(/\r?\n/);
  const container = document.createElement("div");

  lines.forEach((line) => {
    if (!line.trim()) {
      container.appendChild(document.createElement("br"));
      return;
    }

    const paragraph = document.createElement("p");
    const urlPattern = /https?:\/\/[^\s<>"']+/gi;
    let lastIndex = 0;
    let match;

    while ((match = urlPattern.exec(line)) !== null) {
      let url = match[0];
      let trailing = "";
      while (/[),.;!?]$/.test(url)) {
        trailing = url.slice(-1) + trailing;
        url = url.slice(0, -1);
      }

      if (match.index > lastIndex) {
        paragraph.appendChild(document.createTextNode(line.slice(lastIndex, match.index)));
      }

      const link = document.createElement("a");
      link.href = url;
      link.textContent = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "note-link";
      paragraph.appendChild(link);
      if (trailing) paragraph.appendChild(document.createTextNode(trailing));
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < line.length) {
      paragraph.appendChild(document.createTextNode(line.slice(lastIndex)));
    }
    container.appendChild(paragraph);
  });

  noteContentElement.appendChild(container);
}

function selectButton(activeButton) {
  const buttons = notesListElement.querySelectorAll("button");
  buttons.forEach((button) => button.classList.remove("active"));
  activeButton.classList.add("active");
}

function renderMessage(message = "brak notatek w tej kategorii.") {
  notesListElement.innerHTML = "";
  noteTitleElement.textContent = "notatka";
  noteContentElement.textContent = message;
}

function renderError(message) {
  noteContentElement.innerHTML = "";
  const error = document.createElement("p");
  error.className = "note-error";
  error.textContent = message;
  noteContentElement.appendChild(error);
}
