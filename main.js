import "./style.css";
import { Recogito } from "@recogito/recogito-js";
import { $, $$, $$$ } from "./dollars.js";
import "@recogito/recogito-js/dist/recogito.min.css";
import debounce from "./debounce.js";
import { createAnnotationDoc, documentStore, bookmarkStore } from "./store.js";
import { data } from "./data.js";
import { cloneTemplate, plug } from "./templater.js";
import { cache, isCached } from "./cache.js";

const UMLS_BASE_URL = import.meta.env.VITE_UMLS_BASE_URL ?? "";

function adjustElementPosition(targetEl, referenceEl) {
  const coords = getCoords(referenceEl);
  targetEl.style.left = coords.left + coords.width / 2 + "px";
  targetEl.style.top = coords.top + coords.height * 1.1 + "px";
  targetEl.style.transform = "translateX(-50%)";
}

function addTagForElement(el, textContent, documentId, annotationId) {
  const tag = $$$("dfn");
  tag.dataset.documentId = documentId;
  tag.dataset.annotationId = annotationId;
  tag.classList.add("tag");
  tag.textContent = textContent;
  document.body.appendChild(tag);
  tag.adjustTagPosition = () => {
    queueMicrotask(() => adjustElementPosition(tag, el));
  };
  tag.adjustTagPosition();
}

/** @param file {File} */
function handleLoadFile(file) {
  if (file) {
    const reader = new FileReader();

    reader.onload = (event) => {
      let fileContent = event.target.result;
      fileContent = fileContent.replaceAll("\r\n", "\n"); // If don't replace then it won't break the line.
      if (fileContent.includes("�")) {
        reader.readAsText(file, "big5");
        return;
      }
      try {
        const annotationDoc = JSON.parse(fileContent);
        if (
          documentStore.has(annotationDoc.id) &&
          confirm(
            `標記檔 ${annotationDoc.filename} 已經存在，要取代現有的檔案嗎？`,
          )
        ) {
          $(`.documentContainer[data-id="${annotationDoc.id}"]`).remove();
          $$(`.tag[data-document-id="${annotationDoc.id}"]`).forEach((el) =>
            el.remove(),
          );
          documentStore.set(annotationDoc);
        }
        insertAnnotationDoc(annotationDoc);
      } catch (error) {
        // plain text
        const annotationDoc = createAnnotationDoc({
          filename: file.name,
          text: fileContent,
          id: null,
          annotations: null,
        });
        insertAnnotationDoc(annotationDoc);
      }
    };

    reader.readAsText(file);
  } else {
    console.warn("No file selected.");
  }
}

/**
 * @param {AnnotationDoc} annotationDoc
 */
function insertAnnotationDoc(annotationDoc) {
  // is new doc?
  if (!annotationDoc.id) {
    annotationDoc = createAnnotationDoc({
      text: annotationDoc.text,
      id: Date.now().toString(),
      annotations: [],
      filename: annotationDoc.filename,
    });
  }

  const container = cloneTemplate(".documentContainer");
  const { documentContainer, header, content, saveBtn, exportBtn, deleteBtn } =
    container.unbox();

  documentContainer.dataset.id = annotationDoc.id;
  header.textContent = "📝" + annotationDoc.filename;
  content.textContent = annotationDoc.text;
  content.on("scroll", () => {
    $$(content, ".tag").forEach((tag) => tag.adjustTagPosition());
  });
  // We need to append container into document first before initializing Recogito.
  plug("documents", container);

  const r = new Recogito({ content });

  if (annotationDoc.annotations.length != 0) {
    r.setAnnotations(annotationDoc.annotations);
    annotationDoc.annotations.forEach((annotation) => {
      // It seems that after setAnnotations, it would take times to render to the dom.
      const addTag = () => {
        const el = $(`[data-id="${annotation.id}"]`);
        if (!el) {
          // retry addTag
          setTimeout(() => addTag(), 10);
        } else {
          addTagForElement(
            el,
            annotationBodyToString(annotation.body),
            annotationDoc.id,
            annotation.id,
          );
        }
      };
      addTag();
    });
  }

  r.on("createAnnotation", async (annotation, overrideId) => {
    const el = $(`[data-id="${annotation.id}"]`);
    addTagForElement(
      el,
      annotationBodyToString(annotation.body),
      annotationDoc.id,
      annotation.id,
    );
  });
  r.on("deleteAnnotation", async (annotation) => {
    $(`.tag[data-annotation-id="${annotation.id}"]`).remove();
  });
  r.on("updateAnnotation", async (annotation, previous) => {
    $(`.tag[data-annotation-id="${annotation.id}"]`).textContent =
      annotationBodyToString(annotation.body);
  });

  saveBtn.on("click", () => {
    queueMicrotask(() => {
      documentStore.set({ ...annotationDoc, annotations: r.getAnnotations() });
    });
  });
  exportBtn.on("click", () => {
    const annotations = r.getAnnotations();
    const output = JSON.stringify({ ...annotationDoc, annotations });
    const blob = new Blob([output], { type: "application/json" });
    saveFile(blob, annotationDoc.filename + ".json");
  });
  deleteBtn.on("click", () => {
    if (confirm("確定要刪除嗎？")) {
      r.destroy();
      documentStore.delete(annotationDoc.id);
      documentContainer.remove();
      $$(`.tag[data-document-id="${annotationDoc.id}"]`).forEach((el) =>
        el.remove(),
      );
    }
  });
}

async function saveFile(blob, suggestedName) {
  // Feature detection. The API needs to be supported
  // and the app not run in an iframe.
  const supportsFileSystemAccess =
    "showSaveFilePicker" in window &&
    (() => {
      try {
        return window.self === window.top;
      } catch {
        return false;
      }
    })();
  // If the File System Access API is supported…
  if (supportsFileSystemAccess) {
    try {
      // Show the file save dialog.
      const handle = await showSaveFilePicker({
        suggestedName,
      });
      // Write the blob to the file.
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      // Fail silently if the user has simply canceled the dialog.
      if (err.name !== "AbortError") {
        console.error(err.name, err.message);
        return;
      }
    }
  }
  // Fallback if the File System Access API is not supported…
  // Create the blob URL.
  const blobURL = URL.createObjectURL(blob);
  // Create the `<a download>` element and append it invisibly.
  const a = $$$("a");
  a.href = blobURL;
  a.download = suggestedName;
  a.style.display = "none";
  document.body.append(a);
  // Programmatically click the element.
  a.click();
  // Revoke the blob URL and remove the element.
  setTimeout(() => {
    URL.revokeObjectURL(blobURL);
    a.remove();
  }, 1000);
}

/** @param concept {Concept} */
function createConcept(concept) {
  const container = cloneTemplate(".concept");
  const representation = createConceptRepresentation(concept, [
    "importCuiBtn",
    "bookmarkCuiBtn",
    "copyCuiBtn",
  ]);
  plug(container, "conceptRepresentation", representation);

  container.$(".synonyms").textContent =
    "Synonyms: " +
    [
      ...new Set([...concept.synonyms.map(({ term }) => term.toLowerCase())]),
    ].join(", ");
  container.$('[name="semanticTypes"]').append(
    ...concept.semanticTypes.map((s) => {
      const n = cloneTemplate(".semanticType");
      n.textContent = s;
      return n;
    }),
  );
  for (const definition of concept.definitions) {
    const def = cloneTemplate(".definition");
    const { meaning, sourceName } = def.unbox();
    meaning.innerHTML = definition.meaning ?? "";
    sourceName.textContent = definition.sourceName;
    plug(container, "definitions", def);
  }
  plug(
    container,
    "broaderConcepts",
    createChildConceptNodeList(concept.broaderConcepts),
  );
  plug(
    container,
    "narrowerConcepts",
    createChildConceptNodeList(concept.narrowerConcepts),
  );
  return container;
}

function createChildConceptNodeList(concepts) {
  const result = concepts.map(createConceptRepresentation);
  if (result.length == 0) {
    const representation = createConceptRepresentation(
      { cui: "None", preferredName: "" },
      [],
    );
    return [representation];
  } else {
    return result;
  }
}

function createConceptRepresentation(concept, buttons = []) {
  const container = cloneTemplate(".conceptRepresentation");
  const {
    cui,
    preferredName,
    importCuiBtn,
    bookmarkCuiBtn,
    removeBookmarkBtn,
    copyCuiBtn,
    searchCuiBtn,
    conceptRepresentation,
  } = container.unbox();
  cui.textContent = concept.cui;
  cui.href = "https://uts.nlm.nih.gov/uts/umls/concept/" + concept.cui;
  preferredName.textContent = concept.preferredName;

  if (!Array.isArray(buttons) || buttons.length == 0) {
    buttons = ["importCuiBtn", "bookmarkCuiBtn", "copyCuiBtn", "searchCuiBtn"];
  }
  if (buttons.includes("importCuiBtn")) {
    importCuiBtn.on("click", () => {
      const tagInput = $(".r6o-autocomplete input");
      if (tagInput) {
        tagInput.value = concept.cui;
        // 用input event騙react
        tagInput.dispatchEvent(new InputEvent("input"));
        // 緊接著用keydown Enter觸發將文字變成一個tag的指令
        // 注意不能直接接在input event下面，我也不知道為什麼
        // 只能用setTimeout不能用queueMicrotask，而且時間不能設成0，不然會變成註解兩次，原因不明
        setTimeout(() => {
          tagInput.dispatchEvent(new KeyboardEvent("keydown", { which: 13 }));
        }, 1);
      } else {
        alert("請先選擇要匯入CUI標籤的文字");
      }
    });
  } else {
    importCuiBtn.remove();
  }
  if (buttons.includes("removeBookmarkBtn")) {
    removeBookmarkBtn.on("click", () => {
      bookmarkStore.remove(concept);
      conceptRepresentation.remove();
    });
  } else {
    removeBookmarkBtn.remove();
  }
  if (buttons.includes("bookmarkCuiBtn")) {
    bookmarkCuiBtn.on("click", () => {
      insertConceptToBookmark(concept);
    });
  } else {
    bookmarkCuiBtn.remove();
  }
  if (buttons.includes("copyCuiBtn")) {
    copyCuiBtn.on("click", () => {
      try {
        navigator.clipboard.writeText(concept.cui);
      } catch (error) {
        console.error(error);
      }
    });
  } else {
    copyCuiBtn.remove();
  }
  if (buttons.includes("searchCuiBtn")) {
    searchCuiBtn.on("click", () => {
      searchConcept(concept.cui);
    });
  } else {
    searchCuiBtn.remove();
  }
  return container;
}

function isCui(text) {
  return /^C\d{7}$/.test(text);
}

function showMessage(el, message) {
  el.innerHTML = "";
  const msg = $$$("div");
  msg.textContent = message;
  el.append(msg);
}
async function updateConcepts() {
  const slot = $('slot[name="concepts"]');
  function myShowMessage(message) {
    showMessage(slot, message);
  }
  function showNoResult() {
    showMessage(slot, "找不到結果");
  }

  const text = $("#searchBar").value.trim();
  myShowMessage("搜尋中...");
  try {
    let response;
    if (!isCached(text)) {
      if (isCui(text)) {
        response = await fetch(UMLS_BASE_URL + "/umls/concepts/" + text);
      } else {
        // plain text
        response = await fetch(
          UMLS_BASE_URL + "/umls/concepts?queryText=" + text.toLowerCase(),
        );
      }
    }
    if (response?.status === "404") {
      showNoResult();
    } else {
      let json;
      if (isCached(text)) {
        json = cache[text];
      } else {
        json = await response.json();
        cache[text] = json;
      }

      if (json.status == "400" || json.data.length == 0) {
        showNoResult();
      } else {
        slot.innerHTML = "";
        if (Array.isArray(json.data)) {
          plug("concepts", json.data.map(createConcept));
        } else {
          plug("concepts", createConcept(json.data));
        }
      }
    }
  } catch (error) {
    console.error(error);
    myShowMessage("發生錯誤");
  }
}
const debouncedUpdateConcepts = debounce(updateConcepts);

/** @typedef {object} Concept
 * @property {string} cui
 * @property {string} preferredName
 * @property {object[]} definitions
 * @property {object} definitions.concept
 * @property {string} definitions.concept.cui
 * @property {string} definitions.concept.preferredName
 * @property {string} definitions.meaning
 * @property {string} definitions.sourceName
 * @property {object[]} synonyms
 * @property {object} synonyms.concept
 * @property {string} synonyms.concept.cui
 * @property {string} synonyms.concept.preferredName
 * @property {string} synonyms.term
 * @property {string} synonyms.sourceName
 * @property {string[]} semanticTypes
 * @property {} broaderConcepts
 * @property {object[]} narrowerConcepts
 * @property {string} narrowerConcepts.cui
 * @property {string} narrowerConcepts.preferredName
 * @property {object} narrowerConcepts.definition
 * @property {null} narrowerConcepts.definition.concept
 * @property {null} narrowerConcepts.definition.meaning
 * @property {null} narrowerConcepts.definition.sourceName
 */

function annotationBodyToString(body) {
  return body
    .filter(({ purpose }) => purpose == "tagging")
    .map(({ value }) => value)
    .join(", ");
}

// get document coordinates of the element
function getCoords(el) {
  let box = el.getBoundingClientRect();

  return {
    top: box.top + scrollY,
    right: box.right + scrollX,
    bottom: box.bottom + scrollY,
    left: box.left + scrollX,
    width: box.width,
    height: box.height,
  };
}

function insertConceptToBookmark(concept, ignoreDuplicates = false) {
  if (!ignoreDuplicates && bookmarkStore.has(concept)) {
    alert("概念已經在書籤中");
    return;
  }
  const representation = createConceptRepresentation(concept, [
    "importCuiBtn",
    "removeBookmarkBtn",
    "searchCuiBtn",
  ]);
  const el = representation.$(".conceptRepresentation");
  el.on("selecttext", (e) => {
    let add = false;
    const words = e.detail.text.toLowerCase().split(" ");
    const terms = concept.preferredName
      .toLowerCase()
      .split(" ")
      .concat(concept.synonyms.flatMap((s) => s.term.toLowerCase().split(" ")));

    queueMicrotask(() => {
      for (const t of terms) {
        if (words.includes(t)) {
          add = true;
          break;
        }
      }
      if (add) {
        el.classList.add("highlight");
      } else {
        el.classList.remove("highlight");
      }
    });
  });

  plug("bookmarks", representation);
  bookmarkStore.add(concept);
}

function searchConcept(keyword) {
  $("#searchBar").value = keyword;
  $("#searchBar").dispatchEvent(new CustomEvent("search"));
}

// 盤古開天
function openUpHeavenAndEarth() {
  // handle select text auto fill search bar.
  let isSearchOnSelection = true;
  try {
    isSearchOnSelection = JSON.parse(
      localStorage.getItem("isSearchOnSelection"),
    );
  } catch (error) {}
  $("#searchOnSelection").checked = isSearchOnSelection;
  // listen on document text selection
  const observer = new MutationObserver((mutationList, observer) => {
    if (!isSearchOnSelection) return;

    for (const mutationRecord of mutationList) {
      const target = mutationRecord.target;
      if (target.classList.contains("r6o-selection")) {
        searchConcept(target.textContent);
        $$(".conceptRepresentation").forEach((e) =>
          e.dispatchEvent(
            new CustomEvent("selecttext", {
              detail: { text: target.textContent },
            }),
          ),
        );
      }
    }
  });
  observer.observe($("main"), { subtree: true, childList: true });

  $("#searchOnSelection").on("change", () => {
    isSearchOnSelection = !isSearchOnSelection;
    localStorage.setItem("isSearchOnSelection", isSearchOnSelection.toString());
  });

  // handle search
  $("#searchBar").on("input", debouncedUpdateConcepts);
  $("#searchBar").on("search", updateConcepts);

  // handle add bookmark
  $("#addCuiBookmark").on("input", (e) => {
    const text = e.target.value;
    $(".addCuiBookmarkContainer button").disabled = !isCui(text);
  });
  $(".addCuiBookmarkContainer").on("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData($(".addCuiBookmarkContainer"));
    const text = formData.get("cui");
    if (isCui(text)) {
      function msg(msg) {
        showMessage($(".bookmarkSearchStatus"), msg);
      }
      try {
        msg("搜尋中...");
        const response = await fetch(UMLS_BASE_URL + "/umls/concepts/" + text);
        const json = await response.json();
        const concept = json.data;
        if (concept) {
          insertConceptToBookmark(concept);
          msg("　");
        }
      } catch (error) {
        msg(`找不到概念"${text}"`);
      }
    }
  });

  // init annotation doc from localStorage
  for (const doc of documentStore.getAll()) {
    insertAnnotationDoc(doc);
  }

  // init bookmarks from localStorage
  for (const concept of bookmarkStore.getAll()) {
    insertConceptToBookmark(concept, true);
  }

  // handle toggle drawer
  $$(".toggleDrawer").forEach((el) => {
    el.on("click", (e) => {
      if (e.srcElement == el) {
        const drawer = $(
          `.drawer[data-drawer-position="${el.dataset.drawerPosition}"]`,
        );
        drawer.classList.toggle("open");
        const isOpen = $(drawer, "button.toggleDrawer").innerText == "＞"; // do not use textContent, because it would contains whitespace and linebreak
        if (el.dataset.drawerPosition == "right" && !isOpen) {
          setTimeout(() => {
            $("#searchBar").select();
          }, 100);
        }
        $(drawer, "button.toggleDrawer").textContent = isOpen ? "＜" : "＞";
      }
    });
  });

  // adjust tags position when window resize
  window.on("resize", () => {
    $$(".tag").forEach((tag) => tag.adjustTagPosition());
  });

  // handle file uploads
  /** @type {HTMLDivElement} */
  const dropzone = $("#dropzone");
  /** @type {HTMLInputElement} */
  const fileInput = $("#uploadFile");

  // Handle drag and drop events
  dropzone.on("dragover", (event) => {
    event.preventDefault(); // Prevent default browser behavior (open file)
    dropzone.classList.add("dragover"); // Add visual cue for drag-over state
  });

  dropzone.on("dragleave", () => {
    dropzone.classList.remove("dragover"); // Remove visual cue on drag-leave
  });

  dropzone.on("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover"); // Remove visual cue
    if (e.dataTransfer.items) {
      // Use DataTransferItemList interface to access the file(s)
      [...e.dataTransfer.items].forEach((item, i) => {
        // If dropped items aren't files, reject them
        if (item.kind === "file") {
          const file = item.getAsFile();
          handleLoadFile(file);
        }
      });
    } else {
      // Use DataTransfer interface to access the file(s)
      [...e.dataTransfer.files].forEach((file, i) => {
        handleLoadFile(file);
      });
    }
  });

  // Handle click on dropzone to open file selection dialog
  dropzone.on("click", () => {
    fileInput.click();
  });

  // Handle file selection from dialog
  fileInput.on("change", (event) => {
    const selectedFile = event.target.files[0];
    handleLoadFile(selectedFile);
  });
}
openUpHeavenAndEarth();

function initData() {
  // init data
  $('[name="concepts"]').innerHTML = "";
  if (Array.isArray(data.data)) {
    $('[name="concepts"]').append(...data.data.map(createConcept));
  } else {
    $('[name="concepts"]').append(createConcept(json.data));
  }
}

false && initData();
