const RANGE_PANEL_ID = 'rangeSelectPanel';
const RANGE_CLEAR_BUTTON_ID = 'rangeSelectionClearButton';
const RANGE_CLEAR_ROW_ID = 'rangeSelectionClearRow';

const getSelectedBuildingLabel = (entity, index) => (
  (typeof entity === 'string' ? entity : null)
  ?? entity?.name
  ?? entity?.id
  ?? entity?.properties?.name?.getValue?.()
  ?? `建物 ${index + 1}`
);

const getRangeSelectPanel = () => document.getElementById(RANGE_PANEL_ID);
const getRangeClearButton = () => document.getElementById(RANGE_CLEAR_BUTTON_ID);
const getRangeClearRow = () => document.getElementById(RANGE_CLEAR_ROW_ID);

export const ensureRangeSelectPanel = () => {
  const existing = getRangeSelectPanel();
  if (existing) return existing;

  const panel = document.createElement('div');
  panel.id = RANGE_PANEL_ID;
  panel.className = 'range-select-panel';
  panel.innerHTML = `
    <div class="range-select-title">範囲選択</div>
    <div class="range-select-status"></div>
    <div class="range-select-actions">
      <button type="button" data-role="reset">リセット</button>
      <button type="button" data-role="finish">終了</button>
    </div>
    <div class="range-select-list-title">選択建物</div>
    <ol class="range-select-list"></ol>
  `;
  document.body.appendChild(panel);
  return panel;
};

export const bindRangeSelectPanelActions = ({ onReset, onFinish }) => {
  const panel = ensureRangeSelectPanel();
  const resetButton = panel.querySelector('[data-role="reset"]');
  const finishButton = panel.querySelector('[data-role="finish"]');
  if (resetButton) resetButton.onclick = onReset;
  if (finishButton) finishButton.onclick = onFinish;
};

export const setRangePanelStatus = (message) => {
  const panel = ensureRangeSelectPanel();
  const status = panel.querySelector('.range-select-status');
  if (status) status.textContent = message;
};

export const renderRangeSelectedList = (entities = []) => {
  const panel = ensureRangeSelectPanel();
  const list = panel.querySelector('.range-select-list');
  if (!list) return;

  list.innerHTML = '';

  if (!entities.length) {
    const empty = document.createElement('li');
    empty.textContent = 'まだ建物は選択されていません。';
    list.appendChild(empty);
    return;
  }

  entities.forEach((entity, index) => {
    const item = document.createElement('li');
    item.textContent = getSelectedBuildingLabel(entity, index);
    list.appendChild(item);
  });
};

export const destroyRangeSelectPanel = () => {
  getRangeSelectPanel()?.remove();
};

export const updateRangeClearButtonVisibility = ({ visible, onClear }) => {
  if (!visible) {
    getRangeClearButton()?.remove();
    getRangeClearRow()?.remove();
    return;
  }

  const existing = getRangeClearButton();
  if (existing) return;

  const controls = document.getElementById('uiControls');
  const row = document.createElement('div');
  row.id = RANGE_CLEAR_ROW_ID;
  row.className = 'control-row range-clear-row';

  const button = document.createElement('button');
  button.id = RANGE_CLEAR_BUTTON_ID;
  button.className = 'range-clear-button';
  button.type = 'button';
  button.textContent = '範囲設定を解除';
  button.onclick = onClear;
  row.appendChild(button);

  if (controls) {
    controls.appendChild(row);
  } else {
    document.body.appendChild(row);
  }
};
