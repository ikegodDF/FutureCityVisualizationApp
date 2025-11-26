import { appState, setDisasterState, setResult } from '../../state/appState.js';
import { renew3DModels } from '../../tiles/renew3DModels.js';

export const damageAssessment = async (viewer, models = [], disasterState) => {

    const payload = {
        method: 'earthquake_damage_assessment',
        appStateYear: appState.year,
        disasterState: disasterState,
        params: appState.result[appState.appliedPolicy][appState.year][appState.disasterState],
    }

    setDisasterState(disasterState);
    if (appState.result[appState.appliedPolicy][appState.year][appState.disasterState]) {
        console.log(appState);
        renew3DModels(viewer, appState.result[appState.appliedPolicy][appState.year][appState.disasterState]);
        return;
    }

    try {
        console.log(payload);
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const res = await fetch(`${apiBaseUrl}/api/v1/damage_prediction/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        console.log(appState);
        setResult(data.result);
        renew3DModels(viewer, data.result);
    } catch (error) {
        console.error('damage assessment error:', error);
        return [];
    }
}