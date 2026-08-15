import { initGeneralLayout, outputContainer as generalOutputContainer } from './layouts/generalLayout.js';

let outputContainer;

export function initUI(viewer, models) {
  initGeneralLayout(viewer, models);
  outputContainer = generalOutputContainer;
}

export { outputContainer };
