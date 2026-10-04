/**
 * Finding the module's elements on screen. Foundry v14 can detach an application into a browser
 * window of its own, so the tray, the pop-out and chat can live in documents other than the main
 * one. Foundry's detached-window manager searches them all; these are short names for it.
 */

/** Every element matching a selector, in the main document and every detached window. */
export const queryAll = selector => foundry.applications.detached.querySelectorAll(selector);

/** The first element matching a selector, in the main document or any detached window. */
export const queryOne = selector => foundry.applications.detached.querySelector(selector);
