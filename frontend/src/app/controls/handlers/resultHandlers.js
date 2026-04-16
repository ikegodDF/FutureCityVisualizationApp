import { appState } from '../../state/appState.js';

export const result = (viewer, models, outputContainer) => {
  const resultYear = appState.year;
  const safeModels = Array.isArray(models) ? models : [];
  const modelNames = new Set(safeModels.map(m => m && m.name));
  let visibleEntityCount = 0;
  for (const entity of viewer.entities.values) {
    if (modelNames.has(entity.name) && entity.show === true) visibleEntityCount += 1;
  }
  const damagedBuildingCount = safeModels.filter(model => model?.show === false).length;
  const damageCountLabel =
    appState.disasterState === '地震発生後'
      ? '地震被害建物数'
      : appState.disasterState === '津波発生後'
        ? '津波被害建物数'
        : '被害建物数';
  const disasterStateDisplay = appState.disasterState !== '被災前' 
    ? `<br>被害状況:${appState.disasterState}　　${damageCountLabel}:${damagedBuildingCount}` 
    : '';
  outputContainer.innerHTML = `施策:${appState.appliedPolicy}　　年度:${resultYear} 　　建物数:${visibleEntityCount}${disasterStateDisplay}`;
};

