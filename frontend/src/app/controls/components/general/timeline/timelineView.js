export const createTimelineView = ({
  baseYear,
  currentYear,
  maxYears,
  stepYears,
  onApplyYear,
  onTrimFuture,
}) => {
  const wrap = document.createElement('div');
  wrap.className = 'timeline-controls';

  const title = document.createElement('div');
  title.className = 'timeline-title';
  title.textContent = '予測タイムライン';

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

  wrap.appendChild(title);
  wrap.appendChild(labels);
  wrap.appendChild(slider);
  wrap.appendChild(actions);

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
  };
};
