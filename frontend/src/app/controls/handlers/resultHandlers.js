import { appState } from '../../state/appState.js';

export const result = (viewer, models, outputContainer) => {
  const resultYear = appState.year;
  const modelNames = new Set((models || []).map(m => m && m.name));
  const visibleEntityCount = viewer.entities.values.filter(entity => modelNames.has(entity.name) && entity.show === true).length;
  outputContainer.innerHTML = `施策:${appState.appliedPolicy}　　年度:${resultYear} 　　建物数:${visibleEntityCount}`;
};

