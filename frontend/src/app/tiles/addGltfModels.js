import {
  Cartesian3,
  Transforms,
  HeadingPitchRoll,
  Math as CesiumMath,
  ShadowMode,
} from "cesium";
import { getModelColor } from "./getModelColor.js";
import { createModelYear } from "./createModelDetails.js";
import { createModelDescription } from "./modelDescription.js";

// glTFモデル（施策適用前の3Dモデル）を読み込んで追加する
export async function addGltfModels(viewer, regionConfig) {
  const modelNumber = regionConfig?.model?.count ?? 0;
  const modelBasePath = regionConfig?.model?.basePath ?? "/models/mukawa3D";

  const models = [];

  const fixedHeadingPitchRoll = new HeadingPitchRoll(
    CesiumMath.toRadians(90),
    0,
    0,
  );
  const batchSize = 500;
  for (let start = 1; start <= modelNumber; start += batchSize) {
    const end = Math.min(start + batchSize - 1, modelNumber);
    const tasks = [];
    for (let i = start; i <= end; i++) {
      const task = (async () => {
        const base = `${modelBasePath}/OID_${i}/`;
        const jsonPath = `${base}esriGeometryMultiPatch_ESRI3DO.json`;
        const gltfPath = `${base}esriGeometryMultiPatch.glb`;
        try {
          const res = await fetch(jsonPath);
          if (!res.ok) {
            console.log(`${jsonPath} not found`);
            return null;
          }
          const data = await res.json();

          const attrs = data?.attributes ?? {};
          const lat = attrs?.latitude || attrs?.緯度;
          const lon = attrs?.longitude || attrs?.経度;
          const alt = attrs?.altitude ?? attrs?.高度 ?? 0;
          const sourceYear = attrs?.sourceYear || attrs?.築年度;
          const isEstimatedYear = !sourceYear;
          const year = sourceYear || createModelYear();
          const buildingUsage = attrs?.usage || 1;
          const buildingStructureType = attrs?.structure || 3;
          const buildingArea = attrs?.area || 100;
          const buildingHeight = attrs?.height || 7;
          const storeysAboveGround = attrs?.above || 2;
          const architecturalPeriod = attrs?.builtYear ?? attrs?.建築年_ ?? 1;
          const buildingPopulation = 0;

          if (lat == null || lon == null) return null;

          const modelColor = getModelColor(year);

          const modelPosition = Cartesian3.fromDegrees(lon, lat, alt + 33.7);
          const modelOrientation = Transforms.headingPitchRollQuaternion(
            modelPosition,
            fixedHeadingPitchRoll,
          );

          const model = viewer.entities.add({
            id: i,
            name: `model_${i}`,
            position: modelPosition,
            orientation: modelOrientation,
            model: {
              uri: gltfPath,
              scale: 1,
              shadows: ShadowMode.DISABLED,
            },
            year: year,
            isEstimatedYear,
            latlon: [lat, lon],
            latitude: lat,
            longitude: lon,
            altitude: alt,
            buildingUsage,
            buildingStructureType,
            buildingArea,
            buildingHeight,
            storeysAboveGround,
            architecturalPeriod,
            buildingPopulation,
            description: createModelDescription({
              lat,
              lon,
              year,
              isEstimatedYear,
              buildingUsage,
              buildingStructureType,
              buildingArea,
              buildingHeight,
              storeysAboveGround,
              architecturalPeriod,
              buildingPopulation,
            }),
          });
          model.model.color = modelColor;
          return model;
        } catch {
          console.log(`${jsonPath} not found`);
          return null;
        }
      })();
      tasks.push(task);
    }
    const results = await Promise.all(tasks);
    for (const ent of results) if (ent) models.push(ent);
  }

  return models;
}
