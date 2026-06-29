import { ShadowMode } from "cesium";
import { getModelColor, getEscappeColor } from "./getModelColor.js";
import { Color } from "cesium";
import { appState } from "../state/appState.js";

export const renew3DModels = async (viewer, renewModels) => {
  viewer.entities.values.forEach((entity) => {
    const renewModel = renewModels.find((model) => model.name === entity.name);
    if (!renewModel) return;

    // backend の結果に合わせて基本情報を同期
    entity.year = renewModel.year;
    entity.show = renewModel.show;

    // ベースの年代色
    let color = getModelColor(renewModel.year);

    // 計算不能な建物は年代色を半透明にする
    if (renewModel.earthquake_uncomputable || renewModel.thunami_uncomputable) {
      color = color.withAlpha(0.3);
    }

    // GLTFモデルの場合（modelプロパティが存在）
    if (entity.model) {
      entity.model.shadows = ShadowMode.DISABLED;
      entity.model.color = color;
    }
    // CityGMLのpolygonの場合
    else if (entity.polygon) {
      entity.polygon.material = color;
    }
    // CityGMLのboxの場合
    else if (entity.box) {
      entity.box.material = color;
    }
  });
  return renewModels;
};

export const renewTsunamiModels = (viewer, renewModels, casenum) => {
  let totalVictims = 0;
  viewer.entities.values.forEach((entity) => {
    const renewModel = renewModels.find((model) => model.name === entity.name);
    if (!renewModel) return;

    let evacuationType = "early";
    const judgement = Math.random();

    if (casenum == 2) {
      if (judgement < 0.3) {
        evacuationType = "late";
      }
    } else if (casenum == 3) {
      if (judgement < 0.2) {
        evacuationType = "late";
      } else if (judgement > 0.9) {
        evacuationType = "emergence";
      }

      const c3Str = renewModel.tsunami_data
        ? renewModel.tsunami_data.c3Deaths
        : null;
      if (c3Str && c3Str !== "-") {
        totalVictims += parseFloat(c3Str) || 0.0;
      }
    } else if (casenum == 4) {
      if (judgement < 0.5) {
        evacuationType = "late";
      } else if (judgement > 0.7) {
        evacuationType = "emergence";
      }

      const c4Str = renewModel.tsunami_data
        ? renewModel.tsunami_data.c4Deaths
        : null;
      if (c4Str && c4Str !== "-") {
        totalVictims += parseFloat(c4Str) || 0.0;
      }
    }

    // backend の結果に合わせて基本年代情報を同期
    entity.year = renewModel.year;
    if ((renewModel.show == false) & (renewModel.isDamage == true)) {
      entity.show = true;
    }

    let color = getEscappeColor(
      (renewModel.tsunami_data.tsunamiTime % 10) * 10,
    );

    // ランダムで間に合わなくする感じのやつ

    // 🎨 1. ベースの色を取得（デフォルトは元の年代の色）
    // let color = getModelColor(renewModel.year);

    // 🎨 2. 【避難が間に合わない建物だけを黒にする】
    // バックエンドのデータが存在し、かつ該当の避難タイプがTrue（避難不可能）の場合のみ黒に変更
    // const evacData = renewModel.evacuation_data || renewModel.evacuation_data;
    // if (
    //   evacData &&
    //   typeof evacData === "object" &&
    //   evacData[evacuationType] == true
    // ) {
    //   color = Color.BLACK.withAlpha(0.8); // 避難不可能な建物だけを黒に
    // }

    // 🎨 3. 計算不能な建物は年代色（または黒）を半透明にする（元の仕様通り）
    if (renewModel.earthquake_uncomputable || renewModel.thunami_uncomputable) {
      if (color && typeof color.withAlpha === "function") {
        color = color.withAlpha(0.3);
      }
    }

    // 🛠️ 4. 各種エンティティ形式（GLTF, Polygon, Box）への色の適用
    if (entity.model) {
      entity.model.shadows = ShadowMode.DISABLED;
      entity.model.color = color;
    } else if (entity.polygon) {
      entity.polygon.material = color;
    } else if (entity.box) {
      entity.box.material = color;
    }

    // 👁️ 5. 【表示設定の修正】
    // 全壊する建物（isDamage === true）であっても、画面から消さずにマップ上に残すため、
    // フロント側で強制的に表示（entity.show = true）にします。
    // 色は上のステップ1〜3のルール（避難可否に応じた色、または元の年代の色）がそのまま塗られます。
    if (renewModel.isDamage === true) {
      entity.show = true;
    } else {
      entity.show = renewModel.show;
    }
  });

  appState.totalVictims[appState.appliedPolicy][appState.year][
    appState.disasterState
  ] = parseInt(totalVictims);
  return renewModels;
};
