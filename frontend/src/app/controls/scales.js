export function createBuildingAgeLegend() {
  const legendContainer = document.createElement('div');
  legendContainer.id = 'buildingAgeLegend';

  const title = document.createElement('div');
  title.className = 'legend-title';
  title.textContent = '築年数スケール';
  legendContainer.appendChild(title);

  const legendItems = [
    { color: '#8BC34A', label: '0-5年' },
    { color: '#A5D6A7', label: '6-15年' },
    { color: '#FFEB3B', label: '16-25年' },
    { color: '#FF9800', label: '26-35年' },
    { color: '#F44336', label: '36-45年' },
    { color: '#B71C1C', label: '46年以上' },
    { color: '#1976D2', label: '築年不明' },
  ];

  legendItems.forEach(({ color, label }) => {
    const item = document.createElement('div');
    item.className = 'legend-item';

    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.backgroundColor = color;

    const text = document.createElement('span');
    text.className = 'legend-label';
    text.textContent = label;

    item.appendChild(swatch);
    item.appendChild(text);
    legendContainer.appendChild(item);
  });

  return legendContainer;
}
