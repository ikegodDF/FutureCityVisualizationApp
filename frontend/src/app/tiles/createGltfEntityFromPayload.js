import {
  Cartesian3,
  Transforms,
  HeadingPitchRoll,
  Math as CesiumMath,
  ShadowMode,
} from 'cesium';
import { getModelColor } from './getModelColor.js';
import { applyModelPayloadToEntity } from './modelDescription.js';

const fixedHeadingPitchRoll = new HeadingPitchRoll(
  CesiumMath.toRadians(90),
  0,
  0,
);

/**
 * 保存済みペイロードから GLTF 建物エンティティを再生成する。
 * newPrediction で削除された建物の復元に使う。
 */
export function createGltfEntityFromPayload(viewer, payload, regionConfig) {
  const id = payload?.id;
  const lat = payload?.latitude ?? payload?.latlon?.[0];
  const lon = payload?.longitude ?? payload?.latlon?.[1];
  if (id == null || lat == null || lon == null) {
    return null;
  }

  const modelBasePath = regionConfig?.model?.basePath ?? '/models/mukawa3D';
  const gltfPath = `${modelBasePath}/OID_${id}/esriGeometryMultiPatch.glb`;
  const alt = payload.altitude ?? 0;
  const modelPosition = Cartesian3.fromDegrees(lon, lat, alt + 33.7);
  const modelOrientation = Transforms.headingPitchRollQuaternion(
    modelPosition,
    fixedHeadingPitchRoll,
  );

  const entity = viewer.entities.add({
    id,
    name: payload.name ?? `model_${id}`,
    position: modelPosition,
    orientation: modelOrientation,
    model: {
      uri: gltfPath,
      scale: 1,
      shadows: ShadowMode.DISABLED,
    },
    show: payload.show ?? true,
    isEstimatedYear: payload.isEstimatedYear ?? false,
    latlon: [lat, lon],
    latitude: lat,
    longitude: lon,
    altitude: alt,
  });

  applyModelPayloadToEntity(entity, payload);

  const color = getModelColor(entity.year ?? payload.year);
  if (entity.model) {
    entity.model.color = color;
  }

  return entity;
}
