let modalRoot;
let modalBackdrop;
let modalDialog;
let modalContent;

export function initModal() {
  if (document.getElementById('appModalRoot')) return;

  modalRoot = document.createElement('div');
  modalRoot.id = 'appModalRoot';

  modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'modal-backdrop';
  modalBackdrop.addEventListener('click', closeModal);

  modalDialog = document.createElement('div');
  modalDialog.className = 'modal-dialog';

  const header = document.createElement('div');
  header.className = 'modal-header';
  const title = document.createElement('div');
  title.className = 'modal-title';
  title.textContent = '特定状況の呼び出し';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', closeModal);
  header.appendChild(title);
  header.appendChild(closeBtn);

  modalContent = document.createElement('div');
  modalContent.className = 'modal-content';

  modalDialog.appendChild(header);
  modalDialog.appendChild(modalContent);

  modalRoot.appendChild(modalBackdrop);
  modalRoot.appendChild(modalDialog);
  document.body.appendChild(modalRoot);
}

export function openModal(contentNode) {
  initModal();
  setModalContent(contentNode);
  modalRoot.classList.add('show');
}

export function closeModal() {
  if (!modalRoot) return;
  modalRoot.classList.remove('show');
}

export function setModalContent(node) {
  if (!modalContent) return;
  modalContent.innerHTML = '';
  if (node) modalContent.appendChild(node);
}

// ここから: JSON読み込みと施策/年度/被害状況の選択UI
import { appState, setAppliedPolicy, setYear, setDisasterState } from '../state/appState.js';
import { renew3DModels } from '../tiles/renew3DModels.js';
import { result } from './handlers.js';

export function openResultPicker(viewer, models, outputContainer) {
  const wrap = document.createElement('div');

  // 行1: ファイル入力
  const rowFile = document.createElement('div');
  rowFile.className = 'form-row';
  const fileLabel = document.createElement('label');
  fileLabel.textContent = 'JSONファイルを読み込む:';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  rowFile.appendChild(fileLabel);
  rowFile.appendChild(fileInput);

  const loadInfo = document.createElement('div');
  loadInfo.className = 'form-row';

  // 行2: セレクト群
  const selectsRow = document.createElement('div');
  selectsRow.className = 'form-row selects';
  const policySelect = document.createElement('select');
  const yearSelect = document.createElement('select');
  const disasterSelect = document.createElement('select');
  [policySelect, yearSelect, disasterSelect].forEach(s => {
    s.disabled = true;
  });
  selectsRow.appendChild(policySelect);
  selectsRow.appendChild(yearSelect);
  selectsRow.appendChild(disasterSelect);

  // 行3: ボタン群
  const actionsRow = document.createElement('div');
  actionsRow.className = 'form-row actions';
  const runBtn = document.createElement('button');
  runBtn.textContent = '実行';
  runBtn.disabled = true;
  actionsRow.appendChild(runBtn);

  function populatePolicies() {
    policySelect.innerHTML = '';
    const policies = Object.keys(appState.result || {});
    for (const p of policies) {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      policySelect.appendChild(opt);
    }
    policySelect.disabled = policies.length === 0;
  }

  function populateYears() {
    yearSelect.innerHTML = '';
    const p = policySelect.value;
    const yearsObj = appState.result?.[p] || {};
    const years = Object.keys(yearsObj).sort((a,b)=> Number(a)-Number(b));
    for (const y of years) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      yearSelect.appendChild(opt);
    }
    yearSelect.disabled = years.length === 0;
  }

  function populateDisasters() {
    disasterSelect.innerHTML = '';
    const p = policySelect.value;
    const y = yearSelect.value;
    const disastersObj = appState.result?.[p]?.[y] || {};
    const disasters = Object.keys(disastersObj);
    for (const d of disasters) {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      disasterSelect.appendChild(opt);
    }
    disasterSelect.disabled = disasters.length === 0;
    runBtn.disabled = disasters.length === 0;
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (typeof data !== 'object' || data === null) throw new Error('JSONの形式が不正');
        appState.result = data;
        loadInfo.textContent = '読み込み成功: ' + file.name;
        populatePolicies();
        populateYears();
        populateDisasters();
      } catch (e) {
        loadInfo.textContent = '読み込み失敗: ' + (e?.message || e);
      }
    };
    reader.onerror = () => {
      loadInfo.textContent = '読み込み失敗: ファイルを開けませんでした';
    };
    reader.readAsText(file, 'utf-8');
  });

  policySelect.addEventListener('change', () => {
    populateYears();
    populateDisasters();
  });
  yearSelect.addEventListener('change', () => {
    populateDisasters();
  });

  runBtn.addEventListener('click', () => {
    const policy = policySelect.value;
    const year = Number(yearSelect.value);
    const disaster = disasterSelect.value;
    const modelsSel = appState.result?.[policy]?.[year]?.[disaster];
    if (!modelsSel) {
        loadInfo.textContent = 'データがありません';
        return;
    }

    setAppliedPolicy(policy);
    setYear(year);
    setDisasterState(disaster);
    renew3DModels(viewer, modelsSel);
    result(viewer, modelsSel, outputContainer);
    console.log(appState);
    closeModal();
  });

  wrap.appendChild(rowFile);
  wrap.appendChild(loadInfo);
  wrap.appendChild(selectsRow);
  wrap.appendChild(actionsRow);

  // 既存データがあれば初期化
  populatePolicies();
  if (!policySelect.disabled) {
    populateYears();
    if (!yearSelect.disabled) populateDisasters();
  }

  openModal(wrap);
}


