import { Recogito } from "@recogito/recogito-js";
import "@recogito/recogito-js/dist/recogito.min.css";
import { $, $$ } from "./dollars.js";

const UMLS_BASE_URL = import.meta.env.VITE_UMLS_BASE_URL ?? "";

$("#inputText").textContent = "Hello world";

$("#inputText").on("input", async (e) => {
  const text = e.currentTarget.value;
  const matches = await mapText(text);
  $("#json").textContent = JSON.stringify(matches, null, 2);
  $("#result").innerText = text;
  const r = new Recogito({ content: result, mode: "pre" });
  r.setAnnotations(matches.map(matchToRecogitoAnnotation));
});

/**
 * @returns {Match[]}
 */
async function mapText(text) {
  const body = {
    text,
    resultFormat: "fulljson",
  };
  try {
    const response = await fetch(UMLS_BASE_URL + "/metamaplite/free-text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    return result.data.entityList;
  } catch (error) {
    console.error(error);
  }
}

/**
 * @param {Match} match
 */
function matchToRecogitoAnnotation(match) {
  return {
    "@context": "http://www.w3.org/ns/anno.jsonld",
    type: "Annotation",
    body: match.evlist.flatMap((ev) => {
      return [
        {
          type: "TextualBody",
          purpose: "tagging",
          value: ev.conceptinfo.cui,
        },
        {
          type: "TextualBody",
          value: ev.matchedtext + "__" + ev.conceptinfo.preferredname,
        },
      ];
    }),
    target: {
      selector: [
        {
          type: "TextPositionSelector",
          start: match.start,
          end: match.start + match.length,
        },
      ],
    },
    id: Date.now().toString() + (Math.random() * 100000).toFixed(),
  };
}

/** @typedef {object} Match
 * @property {string} matchedtext
 * @property {object[]} evlist
 * @property {number} evlist.score
 * @property {string} evlist.matchedtext
 * @property {number} evlist.start
 * @property {number} evlist.length
 * @property {string} evlist.id
 * @property {object} evlist.conceptinfo
 * @property {string} evlist.conceptinfo.conceptstring
 * @property {string[]} evlist.conceptinfo.sources
 * @property {string} evlist.conceptinfo.cui
 * @property {string} evlist.conceptinfo.preferredname
 * @property {string[]} evlist.conceptinfo.semantictypes
 * @property {string} docid
 * @property {number} start
 * @property {number} length
 * @property {string} id
 * @property {string} fieldid
 */
