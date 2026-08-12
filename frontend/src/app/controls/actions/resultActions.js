import { appState } from '../../state/appState.js';

export const result = (viewer, models, outputContainer) => {
  const resultYear = appState.year;
  const policyKey = String(appState.appliedPolicy);
  const disaster = appState.disasterState;
  const payloads = appState.result?.[policyKey]?.[resultYear]?.[disaster];

  const visibleEntityCount = Array.isArray(payloads)
    ? payloads.filter((model) => model?.show !== false).length
    : (() => {
      const safeModels = Array.isArray(models) ? models : [];
      const modelNames = new Set(safeModels.map((m) => m && m.name));
      let count = 0;
      for (const entity of viewer.entities.values) {
        const isVisible = entity?.show !== false;
        if (modelNames.has(entity.name) && isVisible) count += 1;
      }
      return count;
    })();

  const damagedBuildingCount = Array.isArray(payloads)
    ? payloads.filter((model) => model?.isDamage === true).length
    : 0;

  const damageCountLabel = disaster === '地震発生後'
    ? '地震被害建物数'
    : disaster === '津波発生後'
      ? '津波被害建物数'
      : '被害建物数';

  const peopleNum = appState.totalVictims?.[policyKey]?.[resultYear]?.[disaster] ?? 0;

  const disasterStateDisplay = disaster !== '被災前'
    ? `<br>被害状況:${disaster}　　${damageCountLabel}:${damagedBuildingCount}　　被災者数:${peopleNum}`
    : '';

  outputContainer.innerHTML = `施策:${appState.appliedPolicy}　　年度:${resultYear} 　　建物数:${visibleEntityCount}${disasterStateDisplay}`;
};
