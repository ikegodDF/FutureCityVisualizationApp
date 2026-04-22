import { prediction, restore, result } from '../../../actions/index.js';
import { appState } from '../../../../state/appState.js';
import { renew3DModels } from '../../../../tiles/renew3DModels.js';

export const TIMELINE_MAX_YEARS = 25;
export const TIMELINE_STEP_YEARS = 5;

export const createTimelineController = ({
  viewer,
  models,
  outputContainer,
  baseYear,
}) => {
  const maxYear = baseYear + TIMELINE_MAX_YEARS;

  const ensureCurrentModels = () => {
    const currentModels = appState.result?.[appState.appliedPolicy]?.[appState.year]?.[appState.disasterState];
    if (!Array.isArray(currentModels)) return null;
    renew3DModels(viewer, currentModels);
    return currentModels;
  };

  const syncResult = () => {
    const currentModels = ensureCurrentModels() || models;
    result(viewer, currentModels, outputContainer);
  };

  const moveToYear = async (targetYear) => {
    const normalizedYear = Math.max(baseYear, Math.min(maxYear, targetYear));
    if ((normalizedYear - baseYear) % TIMELINE_STEP_YEARS !== 0) return;

    while (appState.year < normalizedYear) {
      await prediction(viewer, models);
    }
    while (appState.year > normalizedYear) {
      await restore(viewer);
    }

    syncResult();
  };

  const trimFutureFromYear = async (selectedYear) => {
    await moveToYear(selectedYear);

    const policyResult = appState.result?.[appState.appliedPolicy];
    if (!policyResult) return;

    Object.keys(policyResult).forEach((yearKey) => {
      if (Number(yearKey) > selectedYear) {
        delete policyResult[yearKey];
      }
    });
  };

  return {
    moveToYear,
    trimFutureFromYear,
    syncResult,
  };
};
