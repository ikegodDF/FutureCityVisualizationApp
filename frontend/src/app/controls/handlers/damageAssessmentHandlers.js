import { appState, setDisasterState } from '../../state/appState.js';
import { renew3DModels } from '../../tiles/renew3DModels.js';

export const damageAssessment = async (viewer, models = [], disasterState) => {
    setDisasterState(disasterState);
    if (appState.result[appState.appliedPolicy][appState.year][appState.disasterState]) {
        renew3DModels(viewer, appState.result[appState.appliedPolicy][appState.year][appState.disasterState]);
        return;
    }

    const payload = {
        method: 'earthquake_damage_assessment',
        appStateYear: appState.year,
        disasterState: disasterState,
        params: models,
    }
}