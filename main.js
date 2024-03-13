import { Recogito } from "@recogito/recogito-js";
import { $, $$, $$$ } from "./dollars.js";
import "./style.css";
import "@recogito/recogito-js/dist/recogito.min.css";
import { data } from "./data.js";

function addTagForElement(el, textContent) {
	const tag = $$$("dfn");
	tag.classList.add("tag");
	tag.textContent = textContent;
	document.body.appendChild(tag);
	tag["adjustTagPosition"] = () => {
		const elementRect = el.getBoundingClientRect();
		tag.style.left = elementRect.left + "px";
		tag.style.top = elementRect.top + 18 + "px";
	};
	tag.adjustTagPosition();
}

window.addEventListener("resize", () => {
	$$(".tag").forEach((tag) => tag.adjustTagPosition());
});

/** @type {HTMLDivElement} */
const dropzone = $("#dropzone");
/** @type {HTMLInputElement} */
const fileInput = $("#uploadFile");

// Handle drag and drop events
dropzone.addEventListener("dragover", (event) => {
	event.preventDefault(); // Prevent default browser behavior (open file)
	dropzone.classList.add("dragover"); // Add visual cue for drag-over state
});

dropzone.addEventListener("dragleave", () => {
	dropzone.classList.remove("dragover"); // Remove visual cue on drag-leave
});

dropzone.addEventListener("drop", (e) => {
	e.preventDefault();
	dropzone.classList.remove("dragover"); // Remove visual cue
	if (e.dataTransfer.items) {
		// Use DataTransferItemList interface to access the file(s)
		[...e.dataTransfer.items].forEach((item, i) => {
			// If dropped items aren't files, reject them
			if (item.kind === "file") {
				const file = item.getAsFile();
				handleLoadFile(file);
				console.log(`… file[${i}].name = ${file.name}`);
			}
		});
	} else {
		// Use DataTransfer interface to access the file(s)
		[...e.dataTransfer.files].forEach((file, i) => {
			handleLoadFile(file);
			console.log(`… file[${i}].name = ${file.name}`);
		});
	}
});

// Handle click on dropzone to open file selection dialog
dropzone.addEventListener("click", () => {
	fileInput.click();
});

// Handle file selection from dialog
fileInput.addEventListener("change", (event) => {
	const selectedFile = event.target.files[0];
	handleLoadFile(selectedFile);
});

/** @param file {File} */
function handleLoadFile(file) {
	if (file) {
		const reader = new FileReader();

		reader.onload = (event) => {
			const fileContent = event.target.result;
			createNewDocument({ filename: file.name, textContent: fileContent });
		};

		reader.readAsText(file);
	} else {
		console.warn("No file selected.");
	}
}

function createNewDocument({ filename, textContent }) {
	const container = $$$("div");
	container.classList.add("documentContainer");
	const header = $$$("div");
	header.textContent = filename;

	const hr = $$$("hr");

	const content = $$$("div");
	content.textContent = textContent;
	content.classList.add("document");

	const footer = $$$("div");
	const saveBtn = $$$("button");
	saveBtn.textContent = "儲存";
	container.append(header, hr, content, footer);
	footer.appendChild(saveBtn);
	document.body.appendChild(container);
	const r = new Recogito({ content });

	r.on("createAnnotation", async (annotation, overrideId) => {
		const el = $(`[data-id="${annotation.id}"]`);
		addTagForElement(el, annotation.body[0].value);
	});

	saveBtn.addEventListener("click", () => {
		const annotations = r.getAnnotations();
		const output = JSON.stringify(annotations);
		const blob = new Blob([output], { type: "application/json" });
		saveFile(blob, filename + ".json");
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
	$(container, ".preferredName").textContent = concept.preferredName;
	$(container, ".cui").textContent = concept.cui;
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
	document.body.appendChild(container);
}

function createChildConceptNodeList(concepts) {
	const result = concepts.map((c) => {
		const child = $("template.childConcept").content.cloneNode(true);
		$(child, ".cui").textContent = c.cui;
		$(child, ".preferredName").textContent = c.preferredName;
		return child;
	});
	if (result.length == 0) {
		const child = $("template.childConcept").content.cloneNode(true);
		$(child, ".cui").textContent = "None";
		return [child];
	} else {
		return result;
	}
}

createConcept(data.data[0]);

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
