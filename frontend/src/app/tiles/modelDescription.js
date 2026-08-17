import {
  buildingUsageLabels,
  buildingStructureTypeLabels,
} from "./buildingDatas.js";
import { buildBuildingDetail } from "../domain/buildings/toPayload.js";

const displayValue = (value) => (value == null || value === "" ? "-" : value);

const resolveCodeLabel = (value, dictionary) => {
  if (value == null || value === "") return null;
  return dictionary[String(value)] ?? value;
};

export const createModelDescription = ({
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
}) => {
  const yearText = isEstimatedYear
    ? `${displayValue(year)} (推定)`
    : displayValue(year);
  const usageLabel = resolveCodeLabel(buildingUsage, buildingUsageLabels);
  const structureTypeLabel = resolveCodeLabel(
    buildingStructureType,
    buildingStructureTypeLabels,
  );
  return (
    "緯度: " +
    Number(lat).toFixed(6) +
    "<br>" +
    "経度: " +
    Number(lon).toFixed(6) +
    "<br>" +
    "年度: " +
    yearText +
    "<br>" +
    "建物用途: " +
    displayValue(usageLabel) +
    "<br>" +
    "建物構造: " +
    displayValue(structureTypeLabel) +
    "<br>" +
    "建物面積: " +
    displayValue(buildingArea) +
    " m2<br>" +
    "建物高さ: " +
    displayValue(buildingHeight) +
    " m<br>" +
    "建物階数: " +
    displayValue(storeysAboveGround) +
    " 階<br>" +
    "人数: " +
    displayValue(buildingPopulation) +
    " 人<br>"
  );
};

/** API ペイロードの内容をエンティティに反映し、InfoBox 用 description を更新する */
export const applyModelPayloadToEntity = (entity, renewModel) => {
  const detail = renewModel?.buildingDetail ?? renewModel?.BuildingDetail ?? {};

  entity.year = renewModel.year ?? entity.year;
  entity.show = renewModel.show !== false;
  entity.isDamage = renewModel.isDamage === true;

  if (renewModel.latitude != null) entity.latitude = renewModel.latitude;
  if (renewModel.longitude != null) entity.longitude = renewModel.longitude;
  if (renewModel.latitude != null && renewModel.longitude != null) {
    entity.latlon = [renewModel.latitude, renewModel.longitude];
  }

  if (detail.buildingUsage != null) entity.buildingUsage = detail.buildingUsage;
  if (detail.buildingStructureType != null) {
    entity.buildingStructureType = detail.buildingStructureType;
  }
  if (detail.buildingArea != null) entity.buildingArea = detail.buildingArea;
  if (detail.buildingHeight != null) entity.buildingHeight = detail.buildingHeight;
  if (detail.storeysAboveGround != null) {
    entity.storeysAboveGround = detail.storeysAboveGround;
  }
  if (detail.architecturalPeriod != null) {
    entity.architecturalPeriod = detail.architecturalPeriod;
  }
  if (detail.buildingPopulation != null) {
    entity.buildingPopulation = detail.buildingPopulation;
  }
  entity.buildingDetail = {
    ...(entity.buildingDetail ?? {}),
    ...buildBuildingDetail(entity, detail),
  };

  const lat = entity.latitude ?? entity.latlon?.[0];
  const lon = entity.longitude ?? entity.latlon?.[1];

  entity.description = createModelDescription({
    lat,
    lon,
    year: entity.year,
    isEstimatedYear: entity.isEstimatedYear,
    buildingUsage: entity.buildingUsage,
    buildingStructureType: entity.buildingStructureType,
    buildingArea: entity.buildingArea,
    buildingHeight: entity.buildingHeight,
    storeysAboveGround: entity.storeysAboveGround,
    architecturalPeriod: entity.architecturalPeriod,
    buildingPopulation: entity.buildingPopulation ?? 0,
  });
};
