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
  setupUploadModal();
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

function setupUploadModal() {
  const openButton = document.getElementById("open-upload-modal");
  const modal = document.getElementById("upload-modal");
  const cancelButton = document.getElementById("upload-cancel");
  const submitButton = document.getElementById("upload-submit");
  const tokenInput = document.getElementById("upload-token");
  const fileInput = document.getElementById("note-file");
  const overwriteInput = document.getElementById("overwrite-file");
  const statusElement = document.getElementById("upload-status");

  if (!openButton || !modal || !cancelButton || !submitButton) {
    return;
  }

  openButton.addEventListener("click", () => {
    modal.hidden = false;
    statusElement.textContent = "";
    tokenInput.value = "";
  });

  cancelButton.addEventListener("click", () => {
    modal.hidden = true;
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.hidden = true;
    }
  });

  submitButton.addEventListener("click", async () => {
    const token = tokenInput.value.trim();
    const file = fileInput.files?.[0];
    const commitMessage = "nowa notatka";
    const overwrite = overwriteInput.checked;

    if (!token) {
      statusElement.textContent = "Wpisz GitHub token, aby wysłać plik.";
      return;
    }

    if (!file) {
      statusElement.textContent = "Wybierz plik do przesłania.";
      return;
    }

    statusElement.textContent = "Wysyłanie pliku do GitHub...";
    submitButton.disabled = true;

    try {
      await uploadFileToGitHub({ token, file, commitMessage, overwrite });
      statusElement.textContent = "Plik dodany poprawnie. Odświeżam listę notatek...";
      fileInput.value = "";
      overwriteInput.checked = false;
      await loadNotes(topic);
      setTimeout(() => {
        modal.hidden = true;
      }, 600);
    } catch (error) {
      statusElement.textContent = `Błąd wysyłki: ${error.message}`;
    } finally {
      submitButton.disabled = false;
    }
  });
}


function createAuthHeader(token) {
  return token.startsWith("github_pat_") ? `token ${token}` : `Bearer ${token}`;
}

async function uploadFileToGitHub({ token, file, commitMessage, overwrite }) {
  const path = `${topic}/${encodeURIComponent(file.name)}`;
  const apiUrl = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}`;
  const authHeader = createAuthHeader(token);

  let sha;
  const existingResponse = await fetch(`${apiUrl}?ref=${CONFIG.branch}`, {
    headers: {
      Authorization: authHeader,
      Accept: "application/vnd.github+json",
    },
  });

  if (existingResponse.status === 401) {
    throw new Error("Błąd autoryzacji (401). Sprawdź CONFIG.uploadToken i uprawnienia tokenu (repo contents: read/write).");
  }

  if (existingResponse.ok) {
    const existingFile = await existingResponse.json();
    sha = existingFile.sha;

    if (!overwrite) {
      throw new Error("Plik już istnieje. Zaznacz opcję nadpisania, aby kontynuować.");
    }
  }

  if (!existingResponse.ok && existingResponse.status !== 404) {
    throw new Error(`Nie udało się sprawdzić pliku docelowego (${existingResponse.status}).`);
  }

  const arrayBuffer = await file.arrayBuffer();
  const contentBase64 = arrayBufferToBase64(arrayBuffer);

  const body = {
    message: commitMessage,
    content: contentBase64,
    branch: CONFIG.branch,
  };

  if (sha) {
    body.sha = sha;
  }

  const uploadResponse = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      Authorization: authHeader,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!uploadResponse.ok) {
    if (uploadResponse.status === 401) {
      throw new Error("Błąd autoryzacji (401) przy zapisie. Sprawdź CONFIG.uploadToken i uprawnienia tokenu do zapisu.");
    }

    const details = await safeJson(uploadResponse);
    const message = details?.message || `GitHub API zwróciło ${uploadResponse.status}`;
    throw new Error(message);
  }
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}
