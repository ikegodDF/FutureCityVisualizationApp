import {
    Cartesian3,
    Transforms,
    HeadingPitchRoll,
    Math as CesiumMath,
    ShadowMode,
    HeightReference,
} from "cesium";
import { setPopulation } from "../state/appState";


export const addPopulationMesh = async(viewer, regionConfig) =>  {
    console.log(regionConfig)

    const basePath = "/populationMesh";
    const meshPath = regionConfig?.populationMesh?.meshPath;

    const populationMesh = await fetch(`${basePath}${meshPath}`);
    if (!populationMesh.ok) return;

    const meshData = await populationMesh.json();

    setPopulation(meshData);

}