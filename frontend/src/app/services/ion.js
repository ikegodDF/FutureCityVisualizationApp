import { Ion } from 'cesium';

export function setupIon() {
  Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;
}


