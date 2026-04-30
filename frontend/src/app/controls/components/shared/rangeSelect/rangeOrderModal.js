import { closeModal, openModal, setModalCloseHandler } from '../../editor/modal/modalRoot.js';

export const openRangeOrderModal = () => new Promise((resolve) => {
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

  const row = document.createElement('div');
  row.className = 'range-order-actions';

  const createOptionButton = (order, label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => {
      resolveOnce(order);
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
  wrap.appendChild(row);
  wrap.appendChild(cancel);
  openModal(wrap);
});
