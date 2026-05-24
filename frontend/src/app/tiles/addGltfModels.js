import {
  Cartesian3,
  Transforms,
  HeadingPitchRoll,
  Math as CesiumMath,
  ShadowMode,
} from "cesium";
import { getModelColor } from "./getModelColor.js";
import { createModelYear } from "./createModelDetails.js";
import {
  buildingUsageLabels,
  buildingStructureTypeLabels,
} from "./buildingDatas.js";

const displayValue = (value) => (value == null || value === "" ? "-" : value);
const resolveCodeLabel = (value, dictionary) => {
  if (value == null || value === "") return null;
  return dictionary[String(value)] ?? value;
};

const createModelDescription = ({
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
  peopleNum,
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
    displayValue(peopleNum) +
    " 人<br>"
  );
};

// glTFモデル（施策適用前の3Dモデル）を読み込んで追加する
// 役割は addCityGmlModels の GLTF版
export async function addGltfModels(viewer) {
  const modelNumber = 2441;

  const models = [];

  // モデルの角度指定
  const fixedHeadingPitchRoll = new HeadingPitchRoll(
    CesiumMath.toRadians(90),
    0,
    0,
  );
  // バッチ並列実行
  const batchSize = 500;
  for (let start = 1; start <= modelNumber; start += batchSize) {
    const end = Math.min(start + batchSize - 1, modelNumber);
    const tasks = [];
    for (let i = start; i <= end; i++) {
      const task = (async () => {
        const base = `/models/mukawa3D/OID_${i}/`;
        const jsonPath = `${base}esriGeometryMultiPatch_ESRI3DO.json`;
        const gltfPath = `${base}esriGeometryMultiPatch.glb`;
        try {
          const res = await fetch(jsonPath);
          if (!res.ok) return null;
          const data = await res.json();

          const attrs = data?.attributes ?? {};
          const lat = attrs?.latitude;
          const lon = attrs?.longitude;
          const alt = attrs?.高度 ?? 0;
          const sourceYear = attrs?.sourceYear;
          const isEstimatedYear = !sourceYear;
          const year = sourceYear || createModelYear();
          const buildingUsage = attrs?.usage ?? 1;
          const buildingStructureType = attrs?.structure ?? 3;
          const buildingArea = attrs?.area ?? 100;
          const buildingHeight = attrs?.height ?? 7;
          const storeysAboveGround = attrs?.above ?? 2;
          const architecturalPeriod = attrs?.建築年_ ?? null;
          const peopleNum = parseInt(Math.random() * 10);

          if (lat == null || lon == null) return null;

          const modelColor = getModelColor(year);

          const modelPosition = Cartesian3.fromDegrees(lon, lat, 0);
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
            buildingUsage,
            buildingStructureType,
            buildingArea,
            buildingHeight,
            storeysAboveGround,
            architecturalPeriod,
            peopleNum,
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
              peopleNum,
            }),
          });
          model.model.color = modelColor;
          return model;
        } catch {
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

// 津波避難表示
// 総被害数はりゅうさんがくれた各建物の被害人数を合計する
// 避難可能/不可能のマッピングは、確率を用いて行う or 固定ケースを作成する
// 即避難 70% 40% 20%の3ケースを見せる(これらを切り替えるuiを作成)
// 人的被害モード？的なボタンを仮作成

// むかわ
// 範囲設定をjson出力
// 範囲指定ボタンを押したらjsonから範囲を読み取ってそのまま入れる関数を作成・打ち合わせ時にボタンのアクションをその関数に変更
