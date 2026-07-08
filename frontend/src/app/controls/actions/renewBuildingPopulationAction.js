import { appState, setResult } from '../../state/appState.js';
import { buildComputePayload } from '../../region/regionState.js';
import { renew3DModels } from '../../tiles/renew3DModels.js';

export const renewBuildingPopulation = async(viewer) => {

    const payload = buildComputePayload({
        method: 'renew_building_population',
        appStateYear: appState.year -1,
        disasterState: appState.disasterState,
        params: appState.result[appState.appliedPolicy][appState.year][appState.disasterState],
        selectedRanges: appState.selectedRanges[appState.year],
        population: appState.population
    });
      
    console.log(payload);
    
    try {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const res = await fetch(`${apiBaseUrl}/api/v1/calculate/renew_building_population`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        console.log('calculate response:', data);
        setResult(data.result, data.total_victims ?? 0);
        await renew3DModels(viewer, data.result);
        console.log(appState);
        return true;
      } catch (error) {
        console.error('calculate error:', error);
        return false;
      }
}