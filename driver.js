// driver.js
// Define how tutorial goes.
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import triggerTagDialogUrl from "/triggerTagDialog.gif";
import searchOnSelectionUrl from "/searchOnSelection.gif";
import importCuiUrl from "/importCui.gif";
import addToBookmarkUrl from "/addToBookmark.gif";
import manualInputCuiUrl from "/manualInputCui.gif";
import highlightOnSelectionUrl from "/highlightOnSelection.gif";
import searchCuiBtnUrl from "/searchCuiBtn.gif";
import { $, $$ } from "./dollars.js";

let isHelpNeeded = localStorage.getItem("isHelpNeeded");
if (isHelpNeeded == "false") {
  isHelpNeeded = false;
} else {
  isHelpNeeded = true;
}

const driverObj = driver({
  showProgress: true,
  animate: false,
  showButtons: ["next", "previous", "close"],
  popoverClass: "myDriverTheme",
  steps: [
    {
      element: "file-dropzone",
      popover: {
        description: "點擊或拖曳上傳標記文件",
      },
    },
    {
      element: ".documentContainer",
      popover: {
        description: "標記文件區塊",
      },
    },
    {
      element: ".documentContainer .content",
      popover: {
        description: `<img alt="標記方法" src="${triggerTagDialogUrl}" width="487px" height="213px"></img><div>點擊兩下選擇一個字<br/>點選並拖曳可標記任意範圍的文字</div>`,
      },
    },
    {
      element: ".documentContainer .r6o-annotation",
      popover: {
        description:
          '<span class="r6o-annotation">黃色</span>：標記內容<br/><span style="color:#4485ea">藍色文字</span>：所屬標籤',
      },
    },
    {
      element: ".documentContainer .exportBtn",
      popover: {
        description: "標記結果另存新檔",
        side: "bottom",
      },
    },
    {
      element: ".documentContainer .saveBtn",
      popover: {
        description: "暫存文件避免頁面關掉後遺失資料",
        side: "bottom",
      },
    },
    {
      element: ".documentContainer .deleteBtn",
      popover: {
        description: "刪除文件",
        side: "bottom",
      },
    },
    {
      element: ".drawer[data-drawer-position='right']",
      popover: {
        description: "UMLS搜尋面板",
      },
    },
    {
      element: "#searchBar",
      popover: {
        description: "在這裡輸入關鍵字或CUI",
      },
    },
    {
      element: "#searchOnSelectionContainer",
      popover: {
        description: `<img alt="勾選與未勾選的差異" src="${searchOnSelectionUrl}" width="728px"></img><div>勾選此項時，在正中央的標記區塊選擇文字時就會自動帶入關鍵字搜尋概念</div>`,
      },
    },
    {
      element: ".concept .conceptRepresentation",
      popover: {
        description: "Concept Unique Identifier（CUI）及preferred name",
      },
    },
    {
      element: ".concept .importCuiBtn",
      popover: {
        description: `<img alt="匯入CUI" src="${importCuiUrl}" width="727px"></img><div>選取要標記的文字後，點擊按鈕自動填入CUI標籤</div>`,
      },
    },
    {
      element: ".concept .bookmarkCuiBtn",
      popover: {
        description: `<img alt="加入常用CUI" src="${addToBookmarkUrl}" width="728px"></img><div>加入到常用概念</div>`,
      },
    },
    {
      element: ".concept .copyCuiBtn",
      popover: {
        description: "複製CUI到剪貼簿",
      },
    },
    {
      element: ".concept .cui",
      popover: {
        description: "新分頁開啟UMLS概念條目",
      },
    },
    {
      element: '.drawer[data-drawer-position="left"]',
      popover: {
        description: "常用概念面板",
      },
    },
    {
      element: '.drawer[data-drawer-position="left"] .addCuiBookmarkContainer',
      popover: {
        description: `<img alt="輸入CUI加入常用概念" src="${manualInputCuiUrl}" width="359px"></img><div>輸入CUI加入常用概念</div>`,
      },
    },
    {
      element: '.drawer[data-drawer-position="left"] .conceptRepresentation',
      popover: {
        description: `<img alt="選取文字，相關概念變紅色" src="${highlightOnSelectionUrl}" width="806px"></img><div>當選取文字時，有關的概念會變成紅色</div>`,
      },
    },
    {
      element: '.drawer[data-drawer-position="left"] .removeBookmarkBtn',
      popover: {
        description: "從常用概念中移除",
      },
    },
    {
      element: '.drawer[data-drawer-position="left"] .searchCuiBtn',
      popover: {
        description: `<img alt="搜尋概念" src="${searchCuiBtnUrl}" width="740px"></img><div>搜尋概念</div>`,
      },
    },
  ],
  onDestroyed: () => {
    $('[name="concepts"]').innerHTML = "";
    $('[name="bookmarks"]').innerHTML = "";
    $('[name="documents"]').innerHTML = "";
    $$(".tag").kill();

    isHelpNeeded = false;
    localStorage.setItem("isHelpNeeded", isHelpNeeded.toString());
  },
  nextBtnText: "下一步",
  prevBtnText: "上一步",
  doneBtnText: "結束",
});

export function startTutorial() {
  driverObj.drive();
}

export function shouldStartTutorial() {
  return isHelpNeeded;
}

