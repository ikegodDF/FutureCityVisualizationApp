import { prediction, restore, result, earthquakeDamageAssessment, tsunamiDamageAssessment } from '../../../actions/index.js';
import { appState, setAppliedPolicy, setDisasterState } from '../../../../state/appState.js';
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

  const applyDisasterState = async (targetDisasterState) => {
    if (targetDisasterState === appState.disasterState) {
      syncResult();
      return;
    }

    if (targetDisasterState === '被災前') {
      setDisasterState('被災前');
      syncResult();
      return;
    }

    const cached = appState.result?.[appState.appliedPolicy]?.[appState.year]?.[targetDisasterState];
    if (Array.isArray(cached)) {
      setDisasterState(targetDisasterState);
      syncResult();
      return;
    }

    // 被害計算は「被災前」データを入力として使う
    const preDisasterModels = appState.result?.[appState.appliedPolicy]?.[appState.year]?.['被災前'];
    if (Array.isArray(preDisasterModels)) {
      setDisasterState('被災前');
      renew3DModels(viewer, preDisasterModels);
    }

    if (targetDisasterState === '地震発生後') {
      await earthquakeDamageAssessment(viewer, models, '地震発生後');
    } else if (targetDisasterState === '津波発生後') {
      await tsunamiDamageAssessment(viewer, models, '津波発生後');
    }

    syncResult();
  };

  const applyPolicy = async (policyName) => {
    if (!policyName || policyName === appState.appliedPolicy) return;
    setAppliedPolicy(policyName);
    syncResult();
  };

  return {
    moveToYear,
    trimFutureFromYear,
    applyDisasterState,
    applyPolicy,
    syncResult,
  };
};
