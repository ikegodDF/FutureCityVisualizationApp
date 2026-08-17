import { appState } from '../state/appState.js';

export function getOutputDisplayContent(state = appState) {
  const resultYear = state.year;
  const policyKey = String(state.appliedPolicy);
  const disaster = state.disasterState;
  const payloads = state.result?.[policyKey]?.[resultYear]?.[disaster];

  const visibleEntityCount = Array.isArray(payloads)
    ? payloads.filter((model) => model?.show !== false).length
    : 0;

  const damagedBuildingCount = Array.isArray(payloads)
    ? payloads.filter((model) => model?.isDamage === true).length
    : 0;

  const damageCountLabel = disaster === '地震発生後'
    ? '地震被害建物数'
    : disaster === '津波発生後'
      ? '津波被害建物数'
      : '被害建物数';

  const peopleNum = state.totalVictims?.[policyKey]?.[resultYear]?.[disaster] ?? 0;

  const primaryLine = `施策:${state.appliedPolicy}　　年度:${resultYear}　　建物数:${visibleEntityCount}`;
  const lines = [primaryLine];

  if (disaster !== '被災前') {
    lines.push(
      `被害状況:${disaster}　　${damageCountLabel}:${damagedBuildingCount}　　被災者数:${peopleNum}`,
    );
  }

  return {
    lines,
    visibleEntityCount,
    damagedBuildingCount,
    peopleNum,
  };
}

export function renderOutputContainerHtml(lines) {
  if (lines.length === 1) {
    return `<div class="output-row">${lines[0]}</div>`;
  }

  return lines
    .map((line) => `<div class="output-row">${line}</div>`)
    .join('');
}
