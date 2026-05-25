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
// 💡 両方の描画関数をインポート
import {
  renew3DModels,
  renewTsunamiModels,
} from "../../tiles/renew3DModels.js";
// 💡 正しい階層のパスでresult関数をインポート
import { result } from "../actions/resultActions.js";

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

  // 👑 1. ボタンの代わりにドロップダウン（select）を作成
  const selectSimulation = document.createElement("select");
  selectSimulation.className = "simulation-select";

  // 選択肢の定義
  const options = [
    { text: "建物被害", value: "building" },
    { text: "呼びかけによる効果的な避難", value: "case2" },
    { text: "早期避難者が少ない", value: "case3" },
    { text: "早期避難者が多い", value: "case4" },
  ];

  // 選択肢をドロップダウンに追加
  options.forEach((opt) => {
    const option = document.createElement("option");
    option.text = opt.text;
    option.value = opt.value;
    selectSimulation.appendChild(option);
  });

  // 👑 2. 切り替えた時のイベントリスナー (カッコの対応関係を完全に修正)
  selectSimulation.addEventListener("change", () => {
    const currentModels =
      appState.result?.[appState.appliedPolicy]?.[appState.year]?.[
        appState.disasterState
      ];

    if (currentModels) {
      const selectedValue = selectSimulation.value;

      if (selectedValue === "building") {
        renew3DModels(viewer, currentModels);
      } else if (selectedValue === "case2") {
        renewTsunamiModels(viewer, currentModels, 2);
      } else if (selectedValue === "case3") {
        renewTsunamiModels(viewer, currentModels, 3);
      } else if (selectedValue === "case4") {
        renewTsunamiModels(viewer, currentModels, 4);
      }

      // 画面の数字や文字をフォーマット通りに連動・上書き
      result(viewer, models, outputContainer);
    }
  });

  const btnRangeSelect = document.createElement("button");
  btnRangeSelect.textContent = "範囲選択して編集";
  btnRangeSelect.addEventListener("click", () => {
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

  // 👑 3. ここも新しいドロップダウンの変数名に差し替え済み
  row.appendChild(selectSimulation);
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
