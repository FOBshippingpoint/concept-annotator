import "./style.css";
import { Recogito } from "@recogito/recogito-js";
import { $, $$, $$$ } from "./dollars.js";
import "@recogito/recogito-js/dist/recogito.min.css";
import debounce from "./debounce.js";
import { documentStore, bookmarkStore, AnnotationDoc } from "./store.js";
import { cloneTemplate } from "./templater.js";
import { cache, isCached } from "./cache.js";
import { addTagForElement } from "./tag.js";
import { shouldStartTutorial, startTutorial } from "./driver.js";
import { data } from "./data.js";

const UMLS_BASE_URL = import.meta.env.VITE_UMLS_BASE_URL ?? "";

/**
 * @param callback {Function}
 */
function createHandleLoadFile(callback) {
  return (file) => {
    if (file) {
      const reader = new FileReader();

      reader.onload = (event) => {
        let fileContent = event.target.result;
        fileContent = fileContent.replaceAll("\r\n", "\n"); // If don't replace then it won't break the line.
        if (fileContent.includes("�")) {
          reader.readAsText(file, "big5");
          return;
        }
        callback(fileContent);
      };

      reader.readAsText(file);
    } else {
      console.warn("No file selected.");
    }
  };
}

/**
 * @param {AnnotationDoc} annotationDoc
 */
function insertAnnotationDoc(annotationDoc) {
  // is new doc?
  if (!annotationDoc.id) {
    annotationDoc = new AnnotationDoc(
      Date.now().toString(),
      annotationDoc.filename,
      annotationDoc.text,
      [],
    );
  }

  const container = cloneTemplate(".documentContainer");
  const { documentContainer, header, content, saveBtn, exportBtn, deleteBtn } =
    container;

  documentContainer.dataset.id = annotationDoc.id;
  header.textContent = "📝" + annotationDoc.filename;
  if (annotationDoc.type == "xml") {
    content.append(
      new DOMParser().parseFromString(annotationDoc.text, "text/xml")
        .documentElement,
    );
  } else if (annotationDoc.type == "plain text") {
    content.textContent = annotationDoc.text;
  }
  content.on("scroll", () => {
    $$(content, ".tag").do((tag) => tag.adjustPosition());
  });
  // We need to append container into document first before initializing Recogito.
  container.landing("documents");

  const r = new Recogito({ content, mode: "pre" });

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
          addTagForElement(el, annotationBodyToString(annotation.body), {
            documentId: annotationDoc.id,
            annotationId: annotation.id,
          });
        }
      };
      addTag();
    });
  }

  r.on("createAnnotation", async (annotation, overrideId) => {
    const el = $(`[data-id="${annotation.id}"]`);
    addTagForElement(el, annotationBodyToString(annotation.body), {
      documentId: annotationDoc.id,
      annotationId: annotation.id,
    });
  });
  r.on("deleteAnnotation", async (annotation) => {
    $(`.tag[data-annotation-id="${annotation.id}"]`).remove();
  });
  r.on("updateAnnotation", async (annotation, previous) => {
    $(`.tag[data-annotation-id="${annotation.id}"]`).textContent =
      annotationBodyToString(annotation.body);
  });
  r.on("selectAnnotation", async (annotation) => {
    const cui = annotation.body.find(
      ({ purpose }) => purpose == "tagging",
    ).value;
    $$(".conceptRepresentation").do((e) =>
      e.dispatchEvent(
        new CustomEvent("selectannotation", {
          detail: { cui },
        }),
      ),
    );
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
      $$(`.tag[data-document-id="${annotationDoc.id}"]`).kill();
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
  const t = cloneTemplate(".concept");
  const { synonyms, $conceptRepresentation, $semanticType, $definition } = t;
  synonyms.textContent =
    "Synonyms: " +
    [
      ...new Set([...concept.synonyms.map(({ term }) => term.toLowerCase())]),
    ].join(", ");
  $semanticType.plugBy((clone) => {
    return concept.semanticTypes.map((s) => {
      const el = clone();
      el.textContent = s;
      return el;
    });
  });
  const representation = createConceptRepresentation(concept, [
    "importCuiBtn",
    "bookmarkCuiBtn",
    "copyCuiBtn",
  ]);
  $conceptRepresentation.plug(representation);
  $definition.plugBy((clone) =>
    concept.definitions.map((definition) => {
      const el = clone();
      el.meaning.innerHTML = definition.meaning ?? "";
      el.sourceName.textContent = definition.sourceName;
      return el;
    }),
  );
  t.fit(createChildConceptNodeList(concept.broaderConcepts), "broaderConcepts");
  t.fit(
    createChildConceptNodeList(concept.narrowerConcepts),
    "narrowerConcepts",
  );
  return t;
}

function createChildConceptNodeList(concepts) {
  const result = concepts.map((c) =>
    createConceptRepresentation(c, [
      "importCuiBtn",
      "bookmarkCuiBtn",
      "copyCuiBtn",
      "searchCuiBtn",
    ]),
  );
  if (result.length == 0) {
    const representation = createConceptRepresentation(
      {
        cui: "None",
        preferredName: "",
      },
      [],
    );
    return [representation];
  } else {
    return result;
  }
}

function createConceptRepresentation(concept, buttons) {
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
  } = container;
  cui.textContent = concept.cui;
  cui.href = "https://uts.nlm.nih.gov/uts/umls/concept/" + concept.cui;
  preferredName.textContent = concept.preferredName;

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
          UMLS_BASE_URL +
            "/umls/concepts?" +
            new URLSearchParams({ queryText: text.toLowerCase() }),
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
          json.data.forEach((c) => createConcept(c).landing("concepts"));
        } else {
          createConcept(json.data).landing("concepts");
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

function insertConceptToBookmark(concept, ignoreDuplicates = false) {
  if (!ignoreDuplicates && bookmarkStore.has(concept)) {
    alert("概念已經在常用中");
    return;
  }
  const representation = createConceptRepresentation(concept, [
    "importCuiBtn",
    "removeBookmarkBtn",
    "searchCuiBtn",
  ]);
  const { conceptRepresentation } = representation;
  conceptRepresentation.on("selecttext", (e) => {
    let add = false;
    const words = e.detail.text.toLowerCase().split(" ");
    let terms = concept.preferredName.toLowerCase().split(" ");

    if (Array.isArray(concept.synonyms)) {
      terms = terms.concat(
        concept.synonyms.flatMap((s) => s.term.toLowerCase().split(" ")),
      );
    }

    queueMicrotask(() => {
      for (const t of terms) {
        if (words.includes(t)) {
          add = true;
          break;
        }
      }
      if (add) {
        conceptRepresentation.classList.add("highlight");
      } else {
        conceptRepresentation.classList.remove("highlight");
      }
    });
  });
  conceptRepresentation.on("selectannotation", (e) => {
    if (concept.cui == e.detail.cui) {
      let clickCount = 0;
      const removeHighlight = () => {
        clickCount++;
        if (clickCount == 2) {
          $("body").off("click", removeHighlight);
          conceptRepresentation.classList.remove("highlight");
        }
      };
      $("body").on("click", removeHighlight);
      conceptRepresentation.classList.add("highlight");
    }
  });
  representation.landing("bookmarks");
  if (!ignoreDuplicates) {
    bookmarkStore.add(concept);
  }
}

function searchConcept(keyword) {
  $("#searchBar").value = keyword;
  $("#searchBar").dispatchEvent(new CustomEvent("search"));
}

function initFromLocalStorage() {
  // init annotation doc from localStorage
  for (const doc of documentStore.getAll()) {
    insertAnnotationDoc(doc);
  }

  // init bookmarks from localStorage
  for (const concept of bookmarkStore.getAll()) {
    insertConceptToBookmark(concept, true);
  }
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
        $$(".conceptRepresentation").do((e) =>
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
        const concept = await getConceptByCui(text);
        if (concept) {
          insertConceptToBookmark(concept);
          msg("　");
        }
      } catch (error) {
        msg(`找不到概念"${text}"`);
      }
    }
  });

  // handle toggle drawer
  $$(".toggleDrawer").do((el) => {
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
    $$(".tag").do((tag) => tag.adjustPosition());
  });

  $(".tutorialBtn").on("click", () => {
    initTutorialData();
    startTutorial();
  });

  $("file-dropzone").handleLoadFile = createHandleLoadFile((fileContent) => {
    try {
      const annotationDoc = JSON.parse(fileContent);
      if (
        documentStore.has(annotationDoc.id) &&
        confirm(
          `標記檔 ${annotationDoc.filename} 已經存在，要取代現有的檔案嗎？`,
        )
      ) {
        $(`.documentContainer[data-id="${annotationDoc.id}"]`).remove();
        $$(`.tag[data-document-id="${annotationDoc.id}"]`).kill();
        documentStore.set(annotationDoc);
      }
      insertAnnotationDoc(annotationDoc);
    } catch (error) {
      // plain text
      const annotationDoc = new AnnotationDoc(
        null,
        file.name,
        fileContent,
        null,
      );
      insertAnnotationDoc(annotationDoc);
    }
  });

  // handle import pack
  const fileInput = $(".importPackFile");
  $(".importPackBtn").on("click", () => {
    fileInput.click();
  });
  const handleLoadPack = createHandleLoadFile((fileContent) => {
    try {
      const pack = JSON.parse(fileContent);
      if (Array.isArray(pack?.documents) && Array.isArray(pack?.bookmarks)) {
        resetWorkspace();
        pack.documents.forEach(documentStore.set.bind(documentStore));
        pack.documents.forEach(insertAnnotationDoc);
        pack.bookmarks.forEach(bookmarkStore.add.bind(bookmarkStore));
        pack.bookmarks.forEach((b) => insertConceptToBookmark(b, true));
      } else {
        throw Error("Expecting pack.documents and pack.bookmarks to be array.");
      }
    } catch (error) {
      alert("匯入格式有誤");
      console.error(error);
    }
  });
  fileInput.addEventListener("change", (event) => {
    const selectedFile = event.target.files[0];
    handleLoadPack(selectedFile);
  });
  function resetWorkspace() {
    cleanHtml();
    documentStore.deleteAll();
    bookmarkStore.deleteAll();
  }

  $(".resetWorkspaceBtn").on("click", resetWorkspace);
}
openUpHeavenAndEarth();
initFromLocalStorage();

function initTutorialData() {
  cleanHtml();
  createConcept(data.concept).landing("concepts");
  insertConceptToBookmark(data.concept, true);
  insertAnnotationDoc(data.annotationDoc);
}

function cleanHtml() {
  $$(".tag").kill();
  $('[name="concepts"]').innerHTML = "";
  $('[name="bookmarks"]').innerHTML = "";
  $('[name="documents"]').innerHTML = "";
}

if (shouldStartTutorial()) {
  initTutorialData();
  startTutorial();
}

async function getConceptByCui(cui) {
  const response = await fetch(UMLS_BASE_URL + "/umls/concepts/" + cui);
  const json = await response.json();
  const concept = json.data;
  return concept;
}

// window.getCuiList = async (list) => {
//   const concepts = list.trim().split("\n");
//   const result = [];
//   for (const cui of concepts) {
//     const concept = await getConceptByCui(cui);
//     result.push(concept);
//   }
//   console.log(result)
// };
