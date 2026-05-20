import { appState, setDisasterState, setDistribution } from '../../state/appState.js';


export const getDistribution = async () => {

    if (appState.distribution !== null ) {
        
    }

    try {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const res = await fetch(`${apiBaseUrl}/api/v1/get_distribution/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        const data = await res.json();
        console.log('distribution response:', data);

        setDistribution(data.distribution)
        console.log(appState);
        return true;
    } catch (error) {
        console.error('calculate error:', error);
        return false;
    }
}