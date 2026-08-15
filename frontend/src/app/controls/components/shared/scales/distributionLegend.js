import { appState } from '../../../../state/appState.js';

export function createDistributionLegend() {
  const legendContainer = document.createElement('div');
  legendContainer.id = 'distributionLegend';
  legendContainer.className = 'distribution-legend';

  updateLegendContent(legendContainer);

  return legendContainer;
}

export function updateLegendContent(container) {
  
  const shouldShow = appState.disasterState === "地震発生後" || appState.disasterState === "津波発生後";
  
  if (!shouldShow) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = 'flex';
  container.innerHTML = '';

  const title = document.createElement('div');
  title.className = 'legend-title';
  title.textContent = '築年数スケール';
  container.appendChild(title);

  let legendItems = [];
  
  if (appState.disasterState === "地震発生後") {
    title.textContent = '震度スケール';
    legendItems = [
      { color: '#A0F080', label: '震度1' },
      { color: '#00D000', label: '震度2' },    
      { color: '#1040FF', label: '震度3' },     
      { color: '#FFFF00', label: '震度4' },     
      { color: '#FFD700', label: '震度5弱' },   
      { color: '#FF9900', label: '震度5強' },   
      { color: '#FF3300', label: '震度6弱' },   
      { color: '#99001A', label: '震度6強' },   
      { color: '#4A0010', label: '震度7' },     
    ];
  }

  if (appState.disasterState === "津波発生後") {
    title.textContent = '浸水深スケール';
    legendItems = [
      {color:'#A0F080', label: '～0.01m' },
      {color:'#00D000', label: '0.01～0.3m' },
      {color:'#1040FF', label: '0.3～1.0m' },
      {color:'#FFFF00', label: '1.0m～2.0m' },
      {color:'#FFD700', label: '2.0～4.0m' },
      {color:'#FF9900', label: '4.0～6.0m' },
      {color:'#FF3300', label: '6.0～8.0m' },
      {color:'#99001A', label: '8.0～10.0m' },
      {color:'#4A0010', label: '10.0m～' },
    ];
  }

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
    container.appendChild(item);
  });
}