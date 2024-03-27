import "./style.css";
import { Recogito } from "@recogito/recogito-js";
import { $, $$, $$$ } from "./dollars.js";
import "@recogito/recogito-js/dist/recogito.min.css";
import debounce from "./debounce.js";
import { createAnnotationDoc, documentStore, bookmarkStore } from "./store.js";
import { data } from "./data.js";
import { cloneTemplate, plug } from "./templater.js";
import { cache, isCached } from "./cache.js";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

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
  } = container.unbox();
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
        el.classList.add("highlight");
      } else {
        el.classList.remove("highlight");
      }
    });
  });

  plug("bookmarks", representation);
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

  $(".tutorialBtn").on("click", startTutorial);
}
openUpHeavenAndEarth();
initFromLocalStorage();

let isHelpNeeded = localStorage.getItem("isHelpNeeded");
if (isHelpNeeded == "false") {
  isHelpNeeded = false;
} else {
  isHelpNeeded = true;
}

if (isHelpNeeded) {
  startTutorial();
}
function startTutorial() {
  // init data
  $$(".tag").forEach((el) => el.remove());
  $('[name="concepts"]').innerHTML = "";
  $('[name="concepts"]').append(createConcept(data.concept));

  $('[name="bookmarks"]').innerHTML = "";
  insertConceptToBookmark(data.concept, true);

  $('[name="documents"]').innerHTML = "";
  insertAnnotationDoc(data.annotationDoc);

  const driverObj = driver({
    showProgress: true,
    animate: false,
    showButtons: ["next", "previous", "close"],
    steps: [
      {
        element: "#dropzone",
        popover: {
          description: "點擊此按鈕或拖曳檔案來上傳要標記的內容",
        },
      },
      {
        element: ".documentContainer",
        popover: {
          description: "標記文件範例",
        },
      },
      {
        element: ".documentContainer .content",
        popover: {
          description:
            "主要標記區塊，用滑鼠點擊兩下可選擇一個字，點選並拖曳可標記任意範圍的文字",
        },
      },
      {
        element: ".documentContainer .r6o-annotation",
        popover: {
          description: "黃色代表有標記內容，下方的藍色文字為其標籤",
          side: "top",
        },
      },
      {
        element: ".documentContainer .exportBtn",
        popover: {
          description:
            "點擊此按鈕可將標記文件打包成json檔，供後續實驗分析，也可以日後再讀檔繼續標記",
          side: "bottom",
        },
      },
      {
        element: ".documentContainer .saveBtn",
        popover: {
          description:
            "點擊此按鈕可將本文件儲存於瀏覽器中，下次打開頁面資料也不會消失",
          side: "bottom",
        },
      },
      {
        element: ".documentContainer .deleteBtn",
        popover: {
          description: "點擊此按鈕可將本文件刪除",
          side: "bottom",
        },
      },
      {
        element: ".drawer[data-drawer-position='right']",
        popover: {
          description:
            "UMLS搜尋面板，在此搜尋、瀏覽UMLS概念，點擊空白區塊可以展開/收合",
        },
      },
      {
        element: "#searchBar",
        popover: {
          description: "在這裡輸入關鍵字或CUI",
        },
      },
      {
        element: "#searchOnSelection",
        popover: {
          description:
            "勾選此項時，在正中央的標記區塊選擇文字時就會自動帶入關鍵字搜尋概念",
        },
      },
      {
        element: ".concept .conceptRepresentation",
        popover: {
          description: "概念的Concept Unique Identifier（CUI）以及首選名稱（preferred name）",
        },
      },
      {
        element: ".concept .importCuiBtn",
        popover: {
          description:
            "在正中央標記區塊選取要標記的文字範圍後，點擊此按鈕可自動填入CUI標籤",
        },
      },
      {
        element: ".concept .bookmarkCuiBtn",
        popover: {
          description:
            "點擊此按鈕可將常常用到的概念加入左側的常用概念面板以重複使用",
        },
      },
      {
        element: ".concept .copyCuiBtn",
        popover: {
          description: "點擊此按鈕可將CUI複製到剪貼簿",
        },
      },
      {
        element: ".concept .cui",
        popover: {
          description: "在新分頁開啟UMLS官網的概念條目",
        },
      },
      {
        element: '.drawer[data-drawer-position="left"]',
        popover: {
          description: "概念書籤面板，點擊空白區域可以展開/收合",
        },
      },
      {
        element:
          '.drawer[data-drawer-position="left"] .addCuiBookmarkContainer',
        popover: {
          description: "除了從右邊的UMLS面板加入常用概念以外，也可手動輸入",
        },
      },
      {
        element: '.drawer[data-drawer-position="left"] .conceptRepresentation',
        popover: {
          description: "當選取正中間標記區塊的文字時，和目標文字有關的概念會變成紅色",
        },
      },
      {
        element: '.drawer[data-drawer-position="left"] .removeBookmarkBtn',
        popover: {
          description: "點擊此按鈕可將概念從常用概念中移除",
        },
      },
    ],
    onDestroyed: () => {
      $('[name="concepts"]').innerHTML = "";
      $('[name="bookmarks"]').innerHTML = "";
      $('[name="documents"]').innerHTML = "";
      initFromLocalStorage();

      isHelpNeeded = false;
      localStorage.setItem("isHelpNeeded", isHelpNeeded.toString());
    },
    nextBtnText: "下一步",
    prevBtnText: "上一步",
    doneBtnText: "結束",
  });
  driverObj.drive();
}
