/**
 * Finding the module's elements on screen. Foundry v14 can detach an application into a browser
 * window of its own, so the tray, the pop-out and chat can live in documents other than the main
 * one; these helpers look in all of them.
 */

/** The main document and every open detached window's. */
export function allDocuments() {
  const docs = [document];
  for ( const { window: win } of foundry.applications.detached?.windows?.values() ?? [] ) {
    if ( win && !win.closed && win.document ) docs.push(win.document);
  }
  return docs;
}

/** Every element matching a selector, in every document. */
export function queryAll(selector) {
  return allDocuments().flatMap(doc => [...doc.querySelectorAll(selector)]);
}

/** The first element matching a selector, in any document. */
export function queryOne(selector) {
  for ( const doc of allDocuments() ) {
    const found = doc.querySelector(selector);
    if ( found ) return found;
  }
  return null;
}
