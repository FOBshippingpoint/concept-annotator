export const documentStore = {
  getAllId() {
    const listStr = localStorage.getItem("documentList");
    let list = [];
    try {
      const newList = JSON.parse(listStr);
      if (Array.isArray(newList)) {
        list = newList.filter((id) => typeof id == "string");
      }
    } catch (error) {}
    localStorage.setItem("documentList", JSON.stringify(list));
    return list;
  },
  getAll() {
    return this.getAllId()
      .map((id) => this.get(id))
      .filter((doc) => doc != null);
  },
  set(doc) {
    localStorage.setItem(doc.id, JSON.stringify(doc));
    let list = this.getAllId();
    const set = new Set(list);
    set.add(doc.id);
    list = Array.from(set);
    localStorage.setItem("documentList", JSON.stringify(list));
  },
  get(id) {
    try {
      return JSON.parse(localStorage.getItem(id));
    } catch (error) {
      localStorage.removeItem(id);
      return null;
    }
  },
  has(id) {
    return this.getAllId().includes(id);
  },
  delete(id) {
    const newList = this.getAllId().filter((docId) => docId != id);
    localStorage.setItem("documentList", JSON.stringify(newList));
    return localStorage.removeItem(id);
  },
};

export const bookmarkStore = {
  getAll() {
    let items = localStorage.getItem("bookmarks");
    try {
      items = JSON.parse(items);
      if (!Array.isArray(items)) {
        items = [];
      }
      return items;
    } catch (error) {
      localStorage.setItem("bookmarks", "[]");
      items = [];
    }
    return items;
  },
  add(concept) {
    let items = this.getAll();
    if (!this.has(concept)) {
      items.push(concept);
      localStorage.setItem("bookmarks", JSON.stringify(items));
    }
  },
  has(concept) {
    return this.getAll().some(({ cui }) => cui == concept.cui);
  },
  remove(concept) {
    let items = this.getAll().filter(({ cui }) => cui != concept.cui);
    localStorage.setItem("bookmarks", JSON.stringify(items));
  },
  isEmpty() {
    return this.getAll().length == 0;
  },
};

/**
 * @typedef {AnnotationDoc}
 *
 * @property {string} text
 * @property {Object} annotations
 * @property {string} id - Date.now() string in milliseconds
 * @property {string} filename
 */

/**
 * @param {AnnotationDoc} args
 * @returns {AnnotationDoc}
 */
export function createAnnotationDoc({ id, filename, text, annotations }) {
  return {
    id,
    filename,
    text,
    annotations,
  };
}
