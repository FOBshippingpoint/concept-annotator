class FileDropzoneElement extends HTMLElement {
  constructor() {
    super();

    const html = `
      <style>
        :host {
          height: 150px; /* Adjust height as needed */
          border-radius: 5px; /* Rounded corners */
          border: 1px solid #d0d7de;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer; /* Indicate clickable area */
          margin: 10px auto; /* Optional margin for centering */
          background: #f6f8fa; /* Light gray background */
        }
        :host([active]) {
          background: #edf1f4; /* Slightly darker background on drag-over */
          outline: 2px dashed #d0d7de; /* Optional dashed border */
          outline-offset: -6px;
        }
      </style>
      ➕拖曳檔案到此處
      <input type="file" hidden/>
    `;
    const shadowRoot = this.attachShadow({ mode: "open" });
    shadowRoot.innerHTML = html;

    const fileInput = shadowRoot.querySelector("input");

    // Handle drag and drop events
    this.addEventListener("dragover", (event) => {
      event.preventDefault(); // Prevent default browser behavior (open file)
      this.setAttribute("active", "");
    });
    this.addEventListener("dragleave", () => {
      this.removeAttribute("active");
    });

    this.addEventListener("drop", (e) => {
      e.preventDefault();
      this.removeAttribute("active");
      if (e.dataTransfer.items) {
        // Use DataTransferItemList interface to access the file(s)
        [...e.dataTransfer.items].forEach((item, i) => {
          // If dropped items aren't files, reject them
          if (item.kind === "file") {
            const file = item.getAsFile();
            this.handleLoadFile(file);
          }
        });
      } else {
        // Use DataTransfer interface to access the file(s)
        [...e.dataTransfer.files].forEach((file, i) => {
          this.handleLoadFile(file);
        });
      }
    });

    // Handle click on dropzone to open file selection dialog
    this.addEventListener("click", () => {
      fileInput.click();
    });

    // Handle file selection from dialog
    fileInput.addEventListener("change", (event) => {
      const selectedFile = event.target.files[0];
      this.handleLoadFile(selectedFile);
    });
  }

  handleLoadFile() {}
}

customElements.define("file-dropzone", FileDropzoneElement);
