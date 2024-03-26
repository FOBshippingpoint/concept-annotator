export const documentStore = {
  listId() {
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
  list() {
    return this.listId()
      .map((id) => this.get(id))
      .filter((doc) => doc != null);
  },
  set(doc) {
    localStorage.setItem(doc.id, JSON.stringify(doc));
    let list = this.listId();
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
    return this.listId().includes(id);
  },
  delete(id) {
    const newList = this.listId().filter((docId) => docId != id);
    localStorage.setItem("documentList", JSON.stringify(newList));
    return localStorage.removeItem(id);
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
