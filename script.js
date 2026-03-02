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
    const noteFiles = files.filter((file) => /\.(txt|md)$/i.test(file.name));

    if (noteFiles.length === 0) {
      renderMessage("Brak plików .txt lub .md w tym folderze.");
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
  noteContentElement.textContent = "Ładowanie treści notatki...";

  try {
    const response = await fetch(file.download_url);

    if (!response.ok) {
      throw new Error(`Błąd pobierania pliku: ${response.status}`);
    }

    const content = await response.text();
    noteContentElement.textContent = content;
  } catch (error) {
    noteContentElement.textContent = `Nie udało się wczytać pliku. ${error.message}`;
  }
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
