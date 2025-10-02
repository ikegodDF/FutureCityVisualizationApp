// クリックなどのイベントハンドラ群を配置
import { appState, setYear, setResult } from '../state/appState.js';
import { renew3DModels } from '../tiles/renew3DModels.js';

export const prediction = async (viewer, models = []) => {
    
    if (appState.result[appState.appliedPolicy][appState.year + 5]) {
        renew3DModels(viewer, appState.result[appState.appliedPolicy][appState.year + 5][appState.disasterState]);
        setYear(appState.year + 5);
        return ;
    }

    const payload = {
        method: 'building_retention_rate',
        appStateYear: appState.year + 5,
        params: appState.result[appState.appliedPolicy][appState.year][appState.disasterState],
    };

    try {
        const res = await fetch('http://localhost:8000/api/v1/calculate/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        console.log('calculate response:', data);
        await renew3DModels(viewer, data.result);
        setYear(appState.year + 5);
        setResult(data.result);
        console.log(appState);
        return ;
    } catch (error) {
        console.error('calculate error:', error);
        return ;
    }
}


export const restore = async (viewer) => {
    renew3DModels(viewer, appState.result[appState.appliedPolicy][appState.year-5][appState.disasterState]);
    setYear(appState.year - 5);
    return ;
}
export const result = (viewer, models, outputContainer) => {
    const resultYear = appState.year;
  const modelNames = new Set((models || []).map(m => m && m.name));
  const visibleEntityCount = viewer.entities.values.filter(entity => modelNames.has(entity.name) && entity.show === true).length;
    outputContainer.innerHTML = `施策:${appState.appliedPolicy}　　年度:${resultYear} 　　建物数:${visibleEntityCount}`;
}
