import { appState } from '../../state/appState.js';
import { getOutputDisplayContent, renderOutputContainerHtml } from '../../utils/outputDisplay.js';

export const result = (viewer, models, outputContainer) => {
  const resultYear = appState.year;
  const policyKey = String(appState.appliedPolicy);
  const disaster = appState.disasterState;
  const payloads = appState.result?.[policyKey]?.[resultYear]?.[disaster];

  let { lines } = getOutputDisplayContent();

  if (!Array.isArray(payloads)) {
    const safeModels = Array.isArray(models) ? models : [];
    const modelNames = new Set(safeModels.map((m) => m && m.name));
    let count = 0;
    for (const entity of viewer.entities.values) {
      const isVisible = entity?.show !== false;
      if (modelNames.has(entity.name) && isVisible) count += 1;
    }
    lines = [`施策:${appState.appliedPolicy}　　年度:${resultYear}　　建物数:${count}`];
  }

  outputContainer.innerHTML = renderOutputContainerHtml(lines);
};
