import "./style.css";
import { Recogito } from "@recogito/recogito-js";
import { $, $$, $$$ } from "./dollars.js";
import "@recogito/recogito-js/dist/recogito.min.css";
import debounceTrailing from "./debounceTrailing.js";
import { createAnnotationDoc, documentStore } from "./documentStore.js";
import { data } from "./data.js";

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

window.on("resize", () => {
  $$(".tag").forEach((tag) => tag.adjustTagPosition());
});

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

  const container = $("template.documentContainer").content.cloneNode(true);
  $(container, ".documentContainer").dataset.id = annotationDoc.id;
  const header = $(container, ".header");
  header.textContent = "📝" + annotationDoc.filename;
  const content = $(container, ".document");
  content.textContent = annotationDoc.text;
  content.on("scroll", () => {
    $$(content, ".tag").forEach((tag) => tag.adjustTagPosition());
  });
  const saveBtn = $(container, ".save");
  const exportBtn = $(container, ".export");
  const deleteBtn = $(container, ".delete");

  // We need to append container into document first before initializing Recogito.
  $('[name="documents"]').append(container);

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
    console.log("createAnnotation", annotation);
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
      deleteBtn.closest(".documentContainer").remove();
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
  const container = $("template.concept").content.cloneNode(true);
  const representation = createConceptRepresentation(concept);
  $(representation, ".searchCui").remove();
  $(container, '[name="conceptRepresentation"]').append(representation);

  $(container, ".synonyms").textContent =
    "Synonyms: " +
    [
      ...new Set([...concept.synonyms.map(({ term }) => term.toLowerCase())]),
    ].join(", ");
  $(container, '[name="semanticTypes"]').append(
    ...concept.semanticTypes.map((s) => {
      const n = $("template.semanticType").content.cloneNode(true);
      n.textContent = s;
      return n;
    }),
  );
  for (const definition of concept.definitions) {
    const def = $("template.definition").content.cloneNode(true);
    $(def, ".meaning").innerHTML = definition.meaning ?? "";
    $(def, ".sourceName").textContent = definition.sourceName;
    $(container, '[name="definitions"]').appendChild(def);
  }
  $(container, '[name="broaderConcepts"]').append(
    ...createChildConceptNodeList(concept.broaderConcepts),
  );
  $(container, '[name="narrowerConcepts"]').append(
    ...createChildConceptNodeList(concept.narrowerConcepts),
  );
  return container;
}

function createChildConceptNodeList(concepts) {
  const result = concepts.map(createConceptRepresentation);
  if (result.length == 0) {
    const representation = $(
      "template.conceptRepresentation",
    ).content.cloneNode(true);
    $(representation, ".importCui").remove();
    $(representation, ".copyCui").remove();
    $(representation, ".searchCui").remove();
    $(representation, ".cui").textContent = "None";
    return [representation];
  } else {
    return result;
  }
}

function createConceptRepresentation(concept) {
  const container = $("template.conceptRepresentation").content.cloneNode(true);
  $(container, ".cui").textContent = concept.cui;
  $(container, ".cui").href =
    "https://uts.nlm.nih.gov/uts/umls/concept/" + concept.cui;
  $(container, ".preferredName").textContent = concept.preferredName;

  $(container, ".importCui").on("click", () => {
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
  $(container, ".copyCui").on("click", () => {
    try {
      navigator.clipboard.writeText(concept.cui);
    } catch (error) {
      console.error(error);
    }
  });
  $(container, ".searchCui").on("click", () => {
    searchConcept(concept.cui);
  });

  return container;
}

const updateConcepts = debounceTrailing(async () => {
  function showMessage(message) {
    $('[name="concepts"]').innerHTML = "";
    const msg = $$$("div");
    msg.textContent = message;
    $('[name="concepts"]').append(msg);
  }
  function showNoResult() {
    showMessage("找不到結果");
  }

  const text = $("#searchBar").value.trim().toLowerCase();
  const isCui = /^C\d{7}$/.test(text);
  showMessage("搜尋中...");
  try {
    let response;
    if (isCui) {
      response = await fetch(UMLS_BASE_URL + "/umls/concepts/" + text);
    } else {
      // plain text
      response = await fetch(
        UMLS_BASE_URL + "/umls/concepts?queryText=" + text,
      );
    }
    if (response.status === "404") {
      showNoResult();
    } else {
      const json = await response.json();
      if (json.status == "400" || json.data.length == 0) {
        showNoResult();
      } else {
        $('[name="concepts"]').innerHTML = "";
        if (Array.isArray(json.data)) {
          $('[name="concepts"]').append(...json.data.map(createConcept));
        } else {
          $('[name="concepts"]').append(createConcept(json.data));
        }
      }
    }
  } catch (error) {
    console.error(error);
    showMessage("發生錯誤");
  }
});

$$(".toggleConceptSearch").forEach((el) => {
  el.on("click", (e) => {
    if (e.srcElement == el) {
      $(".drawer").classList.toggle("open");
      const isOpen = $("#toggleConceptSearchBtn").innerText == "＞"; // do not use textContent, because it would contains whitespace and linebreak
      if (!isOpen) {
        setTimeout(() => {
          $("#searchBar").select();
        }, 100);
      }
      $("#toggleConceptSearchBtn").textContent = isOpen ? "＜" : "＞";
    }
  });
});

for (const doc of documentStore.list()) {
  insertAnnotationDoc(doc);
}

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

// select text auto fill search bar.
let isSearchOnSelection = true;
try {
  isSearchOnSelection = JSON.parse(localStorage.getItem("isSearchOnSelection"));
} catch (error) {}
$("#searchOnSelection").checked = isSearchOnSelection;
const observer = new MutationObserver((mutationList, observer) => {
  if (!isSearchOnSelection) return;

  for (const mutationRecord of mutationList) {
    const target = mutationRecord.target;
    if (target.classList.contains("r6o-selection")) {
      searchConcept(target.textContent);
    }
  }
});
observer.observe($("main"), { subtree: true, childList: true });

function searchConcept(keyword) {
  $("#searchBar").value = keyword;
  $("#searchBar").dispatchEvent(new InputEvent("input"));
}

$("#searchBar").on("input", updateConcepts);

$("#searchOnSelection").on("change", () => {
  isSearchOnSelection = !isSearchOnSelection;
  localStorage.setItem("isSearchOnSelection", isSearchOnSelection.toString());
});

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
