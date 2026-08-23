import { appState, setDistribution } from '../../state/appState.js';
import { addDistributionModel } from '../../tiles/addDistribution.js';
import { buildComputePayload } from '../../region/regionState.js';
import { setDistributionLegendMode } from '../components/shared/scales/distributionLegend.js';
import {
  ACTIVE_DISTRIBUTION_MODE,
  getDistributionRenderMode,
} from '../components/shared/scales/distributionConfig.js';

export const getDistribution = async (viewer) => {
  try {
    if (!appState.distribution) {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const res = await fetch(`${apiBaseUrl}/api/v1/get_distribution/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildComputePayload({})),
      });
      setDistribution((await res.json()).distribution);
    }

    await addDistributionModel(viewer, getDistributionRenderMode());
    setDistributionLegendMode(ACTIVE_DISTRIBUTION_MODE);
    return true;
  } catch (error) {
    console.error('calculate error:', error);
    return false;
  }
};
