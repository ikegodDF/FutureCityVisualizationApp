import { closeModal, openModal, setModalCloseHandler } from '../../editor/modal/modalRoot.js';

const RANGE_PERIOD_MAX_YEARS = 25;
const RANGE_PERIOD_STEP_YEARS = 5;
const REAL_WORLD_BASE_YEAR = new Date().getFullYear();
const RANGE_PERIOD_MAX_YEAR = REAL_WORLD_BASE_YEAR + RANGE_PERIOD_MAX_YEARS;

export const openRangeOrderModal = ({ currentYear }) => new Promise((resolve) => {
  let settled = false;
  const resolveOnce = (value) => {
    if (settled) return;
    settled = true;
    resolve(value);
  };

  setModalCloseHandler(() => resolveOnce(null));

  const wrap = document.createElement('div');
  wrap.className = 'range-order-modal';

  const title = document.createElement('div');
  title.className = 'range-order-title';
  title.textContent = 'この範囲に適用する処理を選択してください';

  const periodWrap = document.createElement('div');
  periodWrap.className = 'range-order-period';
  const periodLabel = document.createElement('div');
  periodLabel.className = 'range-order-period-label';
  periodLabel.textContent = '適用期間';
  const periodInputs = document.createElement('div');
  periodInputs.className = 'range-order-period-inputs';

  const startText = document.createElement('span');
  startText.className = 'range-order-period-start-text';
  startText.textContent = `${currentYear}年`;

  const arrowText = document.createElement('span');
  arrowText.className = 'range-order-period-arrow';
  arrowText.textContent = '→';

  const endSelect = document.createElement('select');
  endSelect.className = 'range-order-period-end';
  const maxSelectableYear = RANGE_PERIOD_MAX_YEAR;
  for (let year = currentYear; year <= maxSelectableYear; year += RANGE_PERIOD_STEP_YEARS) {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = `${year}年`;
    endSelect.appendChild(option);
  }

  periodInputs.appendChild(startText);
  periodInputs.appendChild(arrowText);
  periodInputs.appendChild(endSelect);
  periodWrap.appendChild(periodLabel);
  periodWrap.appendChild(periodInputs);

  const row = document.createElement('div');
  row.className = 'range-order-actions';

  const createOptionButton = (order, label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => {
      const selectedEndYear = Number(endSelect.value);
      if (selectedEndYear < currentYear) return;
      resolveOnce({
        order,
        period: {
          start: currentYear,
          end: selectedEndYear,
        },
      });
      setModalCloseHandler(null);
      closeModal();
    });
    return button;
  };

  row.appendChild(createOptionButton(1, '1: 範囲内建物を残す'));
  row.appendChild(createOptionButton(2, '2: 範囲外建物を新築化'));
  row.appendChild(createOptionButton(3, '3: continue'));

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'キャンセル';
  cancel.addEventListener('click', () => {
    resolveOnce(null);
    setModalCloseHandler(null);
    closeModal();
  });

  wrap.appendChild(title);
  wrap.appendChild(periodWrap);
  wrap.appendChild(row);
  wrap.appendChild(cancel);
  openModal(wrap);
});
