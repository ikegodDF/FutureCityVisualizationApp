import { flyToJapan } from '../../utils/camera.js';
import '../../../styles/ui.css';
import { appState } from '../../state/appState.js';
import { createTimelineView } from '../components/general/timeline/timelineView.js';
import { createTimelineController, TIMELINE_MAX_YEARS, TIMELINE_STEP_YEARS } from '../components/general/timeline/timelineController.js';
import { createEditMenuBar } from '../components/general/editMenu/editMenuBar.js';
import { createBuildingAgeLegend } from '../components/shared/scales/buildingAgeLegend.js';

let outputContainer;

export function initGeneralLayout(viewer, models) {
  if (document.getElementById('uiControls')) return;
  document.body.classList.add('ui-mode-general');
  document.body.classList.remove('ui-mode-editor');
  const baseYear = appState.year;

  outputContainer = document.createElement('div');
  outputContainer.id = 'outputContainer';
  document.body.appendChild(outputContainer);

  const container = document.createElement('div');
  container.id = 'uiControls';

  const btnFlyJapan = document.createElement('button');
  btnFlyJapan.textContent = '初期位置へ';
  btnFlyJapan.addEventListener('click', () => flyToJapan(viewer));

  const timelineController = createTimelineController({
    viewer,
    models,
    outputContainer,
    baseYear,
  });

  const timeline = createTimelineView({
    baseYear,
    currentYear: appState.year,
    maxYears: TIMELINE_MAX_YEARS,
    stepYears: TIMELINE_STEP_YEARS,
    onApplyYear: async (selectedYear) => {
      await timelineController.moveToYear(selectedYear);
      timeline.setYear(appState.year);
    },
    onTrimFuture: async (selectedYear) => {
      await timelineController.trimFutureFromYear(selectedYear);
      timeline.setYear(appState.year);
    },
  });

  const row = document.createElement('div');
  row.className = 'control-row';
  row.appendChild(btnFlyJapan);
  container.appendChild(row);
  
  const editMenuBar = createEditMenuBar({ title: 'モデル編集' });
  editMenuBar.content.appendChild(timeline.element);
  container.appendChild(editMenuBar.element);
  container.appendChild(createBuildingAgeLegend());

  document.body.appendChild(container);

  timelineController.syncResult();
}

export { outputContainer };
