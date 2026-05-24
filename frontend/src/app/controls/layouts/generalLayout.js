import { flyToMukawa } from "../../utils/camera.js";
import "../../../styles/ui.css";
import { appState } from "../../state/appState.js";
import { startRangeSelection } from "../actions/index.js";
import { getDistribution } from "../actions/getDistribution.js";
import { createTimelineView } from "../components/general/timeline/timelineView.js";
import {
  createTimelineController,
  TIMELINE_MAX_YEARS,
  TIMELINE_STEP_YEARS,
} from "../components/general/timeline/timelineController.js";
import { createEditMenuBar } from "../components/general/editMenu/editMenuBar.js";
import { createBuildingAgeLegend } from "../components/shared/scales/buildingAgeLegend.js";
import {
  createDistributionLegend,
  updateLegendContent,
} from "../components/shared/scales/distributionLegend.js";

// 👑 【デモ用一時追加】同じフォルダ階層（./）に置いた JSON を直接インポート
import demoRangeData from "./mukawa_Range.json";

let outputContainer;

export function initGeneralLayout(viewer, models) {
  if (document.getElementById("uiControls")) return;
  document.body.classList.add("ui-mode-general");
  document.body.classList.remove("ui-mode-editor");
  const baseYear = appState.year;

  outputContainer = document.createElement("div");
  outputContainer.id = "outputContainer";
  document.body.appendChild(outputContainer);

  const container = document.createElement("div");
  container.id = "uiControls";

  const btnFlyJapan = document.createElement("button");
  btnFlyJapan.textContent = "初期位置へ";
  btnFlyJapan.addEventListener("click", () => flyToMukawa(viewer));

  const btnRangeSelect = document.createElement("button");
  btnRangeSelect.textContent = "範囲選択して編集";

  // 👑 ボタンクリック時にインポートしたデータを自動注入する
  btnRangeSelect.addEventListener("click", () => {
    try {
      // データ構造が正しいオブジェクトであるかチェック
      if (
        demoRangeData &&
        typeof demoRangeData === "object" &&
        !Array.isArray(demoRangeData)
      ) {
        // インポートしたデータをディープコピーして appState に安全に注入
        appState.selectedRanges = JSON.parse(JSON.stringify(demoRangeData));
        console.log(
          "【デモ自動化】同じ階層の mukawa_Range.json から範囲データを復元しました。",
        );
      }
    } catch (err) {
      console.warn(
        "【デモ自動化】プリセットデータの読み込みをスキップ、または失敗しました。:",
        err.message,
      );
    }

    // 読み込み完了後、通常通り範囲選択モードを起動（これで裏のデータが自動反映されます）
    startRangeSelection(viewer);
  });

  const btnAddDistribution = document.createElement("button");
  btnAddDistribution.textContent = "分布取得";
  btnAddDistribution.addEventListener("click", () => {
    getDistribution(viewer);
  });

  const timelineController = createTimelineController({
    viewer,
    models,
    outputContainer,
    baseYear,
  });

  const legendElement = createDistributionLegend();

  const timeline = createTimelineView({
    baseYear,
    currentYear: appState.year,
    currentDisasterState: appState.disasterState,
    currentPolicy: appState.appliedPolicy,
    maxYears: TIMELINE_MAX_YEARS,
    stepYears: TIMELINE_STEP_YEARS,
    onApplyYear: async (selectedYear) => {
      await timelineController.moveToYear(selectedYear);
      timeline.setYear(appState.year);
      timeline.setDisasterState(appState.disasterState);
    },
    onDisasterChange: async (disasterState) => {
      await timelineController.applyDisasterState(disasterState);
      timeline.setDisasterState(appState.disasterState);
      updateLegendContent(legendElement);
    },
    onPolicyChange: async (policyName) => {
      await timelineController.applyPolicy(policyName);
    },
    onTrimFuture: async (selectedYear) => {
      await timelineController.trimFutureFromYear(selectedYear);
      timeline.setYear(appState.year);
    },
  });

  const row = document.createElement("div");
  row.className = "control-row";
  row.appendChild(btnFlyJapan);
  row.appendChild(btnRangeSelect);
  row.appendChild(btnAddDistribution);
  container.appendChild(row);
  container.appendChild(createBuildingAgeLegend());
  container.appendChild(legendElement);

  const editMenuBar = createEditMenuBar({ title: "モデル編集" });
  editMenuBar.content.appendChild(timeline.element);
  container.appendChild(editMenuBar.element);

  document.body.appendChild(container);

  timelineController.syncResult();
}

export { outputContainer };
