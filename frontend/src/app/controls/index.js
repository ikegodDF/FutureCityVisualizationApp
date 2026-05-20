import { UI_MODES, getUIMode } from './uiMode.js';
import { initEditorLayout, outputContainer as editorOutputContainer } from './layouts/editorLayout.js';
import { initGeneralLayout, outputContainer as generalOutputContainer } from './layouts/generalLayout.js';

let outputContainer;

export function initUI(viewer, models) {
  const mode = getUIMode();

  if (mode === UI_MODES.GENERAL) {
    initGeneralLayout(viewer, models);
    outputContainer = generalOutputContainer;
    return;
  }

  initEditorLayout(viewer, models);
  outputContainer = editorOutputContainer;
}

export { outputContainer };
