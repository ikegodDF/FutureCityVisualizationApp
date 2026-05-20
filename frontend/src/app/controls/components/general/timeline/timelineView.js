export const createTimelineView = ({
  baseYear,
  currentYear,
  currentDisasterState,
  currentPolicy,
  maxYears,
  stepYears,
  onApplyYear,
  onDisasterChange,
  onPolicyChange,
  onTrimFuture,
}) => {
  const wrap = document.createElement('div');
  wrap.className = 'timeline-controls';

  const board = document.createElement('div');
  board.className = 'timeline-board';

  const timeSection = document.createElement('div');
  timeSection.className = 'timeline-time-section';

  const policySection = document.createElement('div');
  policySection.className = 'timeline-policy-section';
  const disasterSection = document.createElement('div');
  disasterSection.className = 'timeline-policy-section';

  const title = document.createElement('div');
  title.className = 'timeline-title';
  title.textContent = '時系列選択';

  const labels = document.createElement('div');
  labels.className = 'timeline-labels';

  const currentLabel = document.createElement('span');
  currentLabel.className = 'timeline-current';

  const rangeLabel = document.createElement('span');
  rangeLabel.className = 'timeline-range';
  rangeLabel.textContent = `${baseYear} - ${baseYear + maxYears}年`;

  labels.appendChild(currentLabel);
  labels.appendChild(rangeLabel);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'timeline-slider';
  slider.min = String(baseYear);
  slider.max = String(baseYear + maxYears);
  // ドラッグは滑らかにし、離したタイミングで刻みに吸着させる
  slider.step = '1';
  slider.value = String(currentYear);

  const actions = document.createElement('div');
  actions.className = 'timeline-actions';

  const applyBtn = document.createElement('button');
  applyBtn.textContent = 'この年を表示';

  const trimBtn = document.createElement('button');
  trimBtn.textContent = 'この年より先を削除';

  actions.appendChild(applyBtn);
  actions.appendChild(trimBtn);

  const timeBody = document.createElement('div');
  timeBody.className = 'timeline-time-body';
  timeBody.appendChild(labels);
  timeBody.appendChild(slider);
  timeBody.appendChild(actions);

  const timeMain = document.createElement('div');
  timeMain.className = 'timeline-time-main';
  timeMain.appendChild(timeBody);

  timeSection.appendChild(title);
  timeSection.appendChild(timeMain);

  const policyTitle = document.createElement('div');
  policyTitle.className = 'timeline-title';
  policyTitle.textContent = '施策選択';

  const policyGroupWrap = document.createElement('div');
  policyGroupWrap.className = 'timeline-group-wrap';
  const policyGroup = document.createElement('div');
  policyGroup.className = 'timeline-policy-group';
  const policyOptions = ['施策なし', '施策A（仮）', '施策B（仮）'];
  policyOptions.forEach((policyName) => {
    const label = document.createElement('label');
    label.className = 'timeline-policy-option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'generalPolicy';
    input.value = policyName;
    if (policyName === currentPolicy) input.checked = true;
    input.addEventListener('change', async () => {
      if (!input.checked) return;
      await onPolicyChange(policyName);
    });
    const text = document.createElement('span');
    text.textContent = policyName;
    label.appendChild(input);
    label.appendChild(text);
    policyGroup.appendChild(label);
  });
  policyGroupWrap.appendChild(policyGroup);

  const disasterTitle = document.createElement('div');
  disasterTitle.className = 'timeline-title';
  disasterTitle.textContent = '被害選択';

  const disasterGroupWrap = document.createElement('div');
  disasterGroupWrap.className = 'timeline-group-wrap';
  const disasterGroup = document.createElement('div');
  disasterGroup.className = 'timeline-policy-group';
  const disasterInputsByValue = new Map();
  const disasterOptions = [
    { label: '被災前', value: '被災前' },
    { label: '地震', value: '地震発生後' },
    { label: '津波', value: '津波発生後' },
  ];
  disasterOptions.forEach(({ label, value }) => {
    const item = document.createElement('label');
    item.className = 'timeline-policy-option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'generalDisaster';
    input.value = value;
    if (value === currentDisasterState) input.checked = true;
    input.addEventListener('change', async () => {
      if (!input.checked) return;
      await onDisasterChange(value);
    });
    disasterInputsByValue.set(value, input);
    const text = document.createElement('span');
    text.textContent = label;
    item.appendChild(input);
    item.appendChild(text);
    disasterGroup.appendChild(item);
  });
  disasterGroupWrap.appendChild(disasterGroup);

  policySection.appendChild(policyTitle);
  policySection.appendChild(policyGroupWrap);
  disasterSection.appendChild(disasterTitle);
  disasterSection.appendChild(disasterGroupWrap);

  board.appendChild(timeSection);
  board.appendChild(policySection);
  board.appendChild(disasterSection);
  wrap.appendChild(board);

  const getSelectedYear = () => Number(slider.value);
  const snapYear = (year) => {
    const snapped = baseYear + Math.round((year - baseYear) / stepYears) * stepYears;
    return Math.max(baseYear, Math.min(baseYear + maxYears, snapped));
  };

  const updateCurrentLabel = () => {
    currentLabel.textContent = `現在: ${getSelectedYear()}年`;
  };

  slider.addEventListener('input', updateCurrentLabel);
  slider.addEventListener('change', async () => {
    const snappedYear = snapYear(getSelectedYear());
    slider.value = String(snappedYear);
    updateCurrentLabel();
    await onApplyYear(snappedYear);
  });
  applyBtn.addEventListener('click', async () => {
    const snappedYear = snapYear(getSelectedYear());
    slider.value = String(snappedYear);
    await onApplyYear(snappedYear);
    updateCurrentLabel();
  });
  trimBtn.addEventListener('click', async () => {
    await onTrimFuture(getSelectedYear());
    updateCurrentLabel();
  });

  updateCurrentLabel();

  return {
    element: wrap,
    setYear: (year) => {
      slider.value = String(year);
      updateCurrentLabel();
    },
    setDisasterState: (disasterState) => {
      const target = disasterInputsByValue.get(disasterState);
      if (target) target.checked = true;
    },
  };
};
