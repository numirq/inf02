const CONFIG = {
  // Uzupełnij, aby GitHub API działało po publikacji.
  // Przykład: owner: "jan-kowalski", repo: "notatki-os"
  owner: "numirq",
  repo: "inf02",
  branch: "main",
};

const notesListElement = document.getElementById("notes-list");
const noteTitleElement = document.getElementById("note-title");
const noteContentElement = document.getElementById("note-content");
const topic = document.body.dataset.topic;

if (topic && notesListElement && noteTitleElement && noteContentElement) {
  loadNotes(topic);
}

async function loadNotes(folderName) {
  renderMessage("Ładowanie listy notatek...");

  if (CONFIG.owner === "TWOJ_LOGIN_GITHUB" || CONFIG.repo === "TWOJE_REPO") {
    renderMessage(
      "Uzupełnij dane repozytorium w pliku script.js (CONFIG.owner i CONFIG.repo), aby pobrać notatki z GitHub API."
    );
    return;
  }

  const apiUrl = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${folderName}?ref=${CONFIG.branch}`;

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`Błąd GitHub API: ${response.status}`);
    }

    const files = await response.json();
    const supportedExtensions = /\.(txt|md|jpg|jpeg|png|gif|webp|pdf)$/i;
    const noteFiles = files.filter((file) => supportedExtensions.test(file.name));

    if (noteFiles.length === 0) {
      renderMessage("Brak obsługiwanych plików (.txt, .md, .jpg, .png, .pdf itd.) w tym folderze.");
      return;
    }

    notesListElement.innerHTML = "";

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
    renderMessage(`Nie udało się pobrać listy plików. ${error.message}`);
  }
}

async function loadNoteContent(file) {
  noteTitleElement.textContent = file.name;
  noteContentElement.innerHTML = "Ładowanie zawartości...";

  const extension = (file.name.split(".").pop() || "").toLowerCase();

  if (["jpg", "jpeg", "png", "gif", "webp"].includes(extension)) {
    renderImage(file);
    return;
  }

  if (extension === "pdf") {
    renderPdf(file);
    return;
  }

  try {
    const response = await fetch(file.download_url);

    if (!response.ok) {
      throw new Error(`Błąd pobierania pliku: ${response.status}`);
    }

    const content = await response.text();
    const pre = document.createElement("pre");
    pre.textContent = content;
    noteContentElement.innerHTML = "";
    noteContentElement.appendChild(pre);
  } catch (error) {
    noteContentElement.textContent = `Nie udało się wczytać pliku. ${error.message}`;
  }
}

function renderImage(file) {
  noteContentElement.innerHTML = "";
  const image = document.createElement("img");
  image.src = file.download_url;
  image.alt = file.name;
  image.loading = "lazy";

  image.addEventListener("error", () => {
    noteContentElement.textContent = "Nie udało się wyświetlić obrazu.";
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
  fallback.innerHTML = `Przeglądarka nie obsługuje osadzania PDF. <a href="${file.download_url}" target="_blank" rel="noopener noreferrer">Otwórz plik PDF</a>.`;

  object.appendChild(fallback);
  noteContentElement.appendChild(object);
}

function selectButton(activeButton) {
  const buttons = notesListElement.querySelectorAll("button");
  buttons.forEach((button) => button.classList.remove("active"));
  activeButton.classList.add("active");
}

function renderMessage(message) {
  notesListElement.innerHTML = "";
  noteTitleElement.textContent = "Informacja";
  noteContentElement.textContent = message;
}
