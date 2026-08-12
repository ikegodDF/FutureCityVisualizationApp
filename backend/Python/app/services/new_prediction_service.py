from __future__ import annotations

import random
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Literal, Optional, Tuple

import numpy as np
from scipy.stats import norm

from ..models.schemas import (
    Model3D,
    NewPredictionRequest,
    NewPredictionResponse,
    selectedRange,
)

DistributionNode = Dict[str, float | str]
DistributionStatus = Literal["INVALID", "FIXED", "DISTRIBUTION"]


@dataclass(frozen=True)
class NewPredictionPlan:
    """区分別の現在数・予測数・削除数・新築数。"""

    current_counts: List[int]
    predicted_counts: List[int]
    delete_by_category: List[int]
    add_by_category: List[int]
    final_nodes: List[DistributionNode]

    @property
    def delete_count(self) -> int:
        return sum(self.delete_by_category)

    @property
    def add_count(self) -> int:
        return sum(self.add_by_category)


class NewPredictionService:
    STEP_YEARS = 5
    HB_RATE = 0.059832469
    SURVIVAL_RATES = [
        1.0, 0.90041, 0.90041, 0.94084, 0.94084,
        0.90579, 0.90579, 0.73573, 0.73573, 0.60935,
    ]
    CATEGORY_COUNT = 10
    CATEGORY_LABELS = [
        "0~5年", "6~10年", "11~15年", "16~20年", "21~25年",
        "26~30年", "31~35年", "36~40年", "41~45年", "46年~",
    ]
    OVER46_INDEX = CATEGORY_COUNT - 1

    def run(self, request: NewPredictionRequest) -> NewPredictionResponse:
        start_time = time.time()
        id_dict = self._build_range_order_map(
            request.selectedRanges or [],
            request.appStateYear,
        )
        eligible_params = self._collect_eligible_buildings(request.params, id_dict)
        plan = self._build_plan(
            eligible_params,
            request.appStateYear,
            request.addYear,
            request.percentage,
        )
        delete_ids = self._pick_delete_ids(
            eligible_params,
            request.appStateYear,
            plan.delete_by_category,
        )
        new_models = self._build_new_models(
            plan.add_by_category,
            request.appStateYear + request.addYear,
            request.region,
        )
        return NewPredictionResponse(
            deletes=delete_ids,
            models=new_models,
            add_num=plan.add_by_category,
            duration_ms=(time.time() - start_time) * 1000,
            timestamp=datetime.now(),
        )

    # ------------------------------------------------------------------
    # 計画の組み立て
    # ------------------------------------------------------------------

    def _build_plan(
        self,
        eligible_params: List[Model3D],
        app_state_year: int,
        add_year: int,
        percentage: float,
    ) -> NewPredictionPlan:
        current_counts = self._count_by_category(eligible_params, app_state_year)
        self._log_header(current_counts, app_state_year, add_year, percentage)
        predicted_counts, final_nodes = self._predict_category_counts(
            current_counts,
            add_year,
            percentage,
            start_year=app_state_year,
        )
        add_by_category = self._compute_add_by_category(predicted_counts, add_year)
        delete_by_category = self._compute_delete_by_category(
            current_counts,
            predicted_counts,
            add_year,
        )
        plan = NewPredictionPlan(
            current_counts=current_counts,
            predicted_counts=predicted_counts,
            delete_by_category=delete_by_category,
            add_by_category=add_by_category,
            final_nodes=final_nodes,
        )
        self._log_summary(plan, add_year)
        return plan

    def _compute_add_by_category(
        self,
        predicted_counts: List[int],
        add_year: int,
    ) -> List[int]:
        num_steps = self._num_steps(add_year)
        add_by_category = [0] * len(predicted_counts)
        for index in range(min(num_steps, len(predicted_counts))):
            add_by_category[index] = predicted_counts[index]
        return add_by_category

    def _compute_delete_by_category(
        self,
        current_counts: List[int],
        predicted_counts: List[int],
        add_year: int,
    ) -> List[int]:
        num_steps = self._num_steps(add_year)
        delete_by_category = [0] * len(current_counts)
        over46_contributors = self._over46_contributor_indices(num_steps)
        over46_set = set(over46_contributors)

        for source_index, current_count in enumerate(current_counts):
            if current_count <= 0 or source_index in over46_set:
                continue
            target_index = source_index + num_steps
            predicted_at_target = predicted_counts[target_index]
            delete_by_category[source_index] = max(0, current_count - predicted_at_target)

        if not over46_contributors:
            return delete_by_category

        expected_by_source = {
            source_index: current_counts[source_index]
            * self._survival_path_to_target(source_index, num_steps)
            for source_index in over46_contributors
            if current_counts[source_index] > 0
        }
        total_expected = sum(expected_by_source.values())
        predicted_over46 = predicted_counts[self.OVER46_INDEX]

        for source_index in over46_contributors:
            current_count = current_counts[source_index]
            if current_count <= 0:
                continue
            expected = expected_by_source.get(source_index, 0.0)
            allocated = (
                predicted_over46 * expected / total_expected
                if total_expected > 0
                else 0.0
            )
            delete_by_category[source_index] = max(
                0,
                current_count - int(round(allocated)),
            )
        return delete_by_category

    # ------------------------------------------------------------------
    # 正規分布シミュレーション
    # ------------------------------------------------------------------

    def _predict_category_counts(
        self,
        initial_counts: List[int],
        add_year: int,
        percentage: float,
        *,
        start_year: int,
    ) -> Tuple[List[int], List[DistributionNode]]:
        final_nodes = self._simulate(initial_counts, add_year, start_year=start_year)
        predicted_counts = [
            self._count_from_node(node, percentage)
            for node in final_nodes
        ]
        return predicted_counts, final_nodes

    def _simulate(
        self,
        initial_counts: List[int],
        add_year: int,
        *,
        start_year: int,
    ) -> List[DistributionNode]:
        num_steps = self._num_steps(add_year)
        init_nodes = self._initial_nodes(initial_counts)
        history = [self._advance_step(0, init_nodes, init_nodes, is_first_step=True, start_year=start_year)]
        for step_index in range(1, num_steps):
            history.append(
                self._advance_step(
                    step_index,
                    history[-1],
                    history[-1],
                    is_first_step=False,
                    start_year=start_year,
                )
            )
        return history[-1]

    def _initial_nodes(self, initial_counts: List[int]) -> List[DistributionNode]:
        nodes: List[DistributionNode] = []
        for count in initial_counts:
            if count > 0:
                nodes.append({"mu": float(count), "var": 0.0, "status": "FIXED"})
            else:
                nodes.append({"mu": 0.0, "var": 0.0, "status": "INVALID"})
        return nodes

    def _advance_step(
        self,
        step_index: int,
        prev_nodes: List[DistributionNode],
        source_nodes: List[DistributionNode],
        *,
        is_first_step: bool,
        start_year: int,
    ) -> List[DistributionNode]:
        target_year = start_year + (step_index + 1) * self.STEP_YEARS
        print(f"\n--- Step {step_index + 1}: {target_year}年 ---")

        current_nodes: List[DistributionNode] = []
        current_nodes.append(
            self._new_construction_node(prev_nodes, is_first_step=is_first_step)
        )

        for category_index in range(1, self.CATEGORY_COUNT - 1):
            prev_node = source_nodes[category_index - 1]
            survival_rate = self.SURVIVAL_RATES[category_index - 1]
            current_nodes.append(self._survival_transition(prev_node, survival_rate))

        node_from_41 = self._survival_transition(
            source_nodes[self.CATEGORY_COUNT - 2],
            self.SURVIVAL_RATES[self.CATEGORY_COUNT - 2],
        )
        node_from_46 = self._survival_transition(
            source_nodes[self.CATEGORY_COUNT - 1],
            self.SURVIVAL_RATES[self.CATEGORY_COUNT - 1],
        )
        current_nodes.append(self._combine_nodes(node_from_41, node_from_46))
        return current_nodes

    def _new_construction_node(
        self,
        prev_nodes: List[DistributionNode],
        *,
        is_first_step: bool,
    ) -> DistributionNode:
        total_mu = sum(node["mu"] for node in prev_nodes if node["status"] != "INVALID")
        total_var = sum(node["var"] for node in prev_nodes if node["status"] != "INVALID")
        if total_mu <= 0 or self.HB_RATE <= 0:
            return {"mu": 0.0, "var": 0.0, "status": "INVALID"}

        if is_first_step:
            mu = total_mu * self.HB_RATE
            var = total_mu * self.HB_RATE * (1.0 - self.HB_RATE)
        else:
            mu = self.HB_RATE * total_mu
            var = (
                self.HB_RATE * (1.0 - self.HB_RATE) * total_mu
                + (self.HB_RATE ** 2) * total_var
            )
        return {"mu": mu, "var": var, "status": "DISTRIBUTION"}

    @staticmethod
    def _survival_transition(
        prev_node: DistributionNode,
        survival_rate: float,
    ) -> DistributionNode:
        status = prev_node["status"]
        mu_prev = float(prev_node["mu"])
        var_prev = float(prev_node["var"])

        if status == "INVALID" or mu_prev <= 0:
            return {"mu": 0.0, "var": 0.0, "status": "INVALID"}
        if survival_rate >= 1.0:
            if status == "FIXED" or var_prev <= 0:
                return {"mu": mu_prev, "var": 0.0, "status": "FIXED"}
            return {"mu": mu_prev, "var": var_prev, "status": "DISTRIBUTION"}
        if status == "FIXED" or var_prev <= 0:
            return {
                "mu": survival_rate * mu_prev,
                "var": survival_rate * (1.0 - survival_rate) * mu_prev,
                "status": "DISTRIBUTION",
            }
        return {
            "mu": survival_rate * mu_prev,
            "var": survival_rate * (1.0 - survival_rate) * mu_prev + (survival_rate ** 2) * var_prev,
            "status": "DISTRIBUTION",
        }

    @staticmethod
    def _combine_nodes(
        node_a: DistributionNode,
        node_b: DistributionNode,
    ) -> DistributionNode:
        if node_a["status"] == "INVALID" and node_b["status"] == "INVALID":
            return {"mu": 0.0, "var": 0.0, "status": "INVALID"}
        if node_a["status"] == "INVALID":
            return node_b
        if node_b["status"] == "INVALID":
            return node_a

        mu = float(node_a["mu"]) + float(node_b["mu"])
        var = float(node_a["var"]) + float(node_b["var"])
        status: DistributionStatus = (
            "DISTRIBUTION"
            if (
                node_a["status"] == "DISTRIBUTION"
                or node_b["status"] == "DISTRIBUTION"
                or var > 0
            )
            else "FIXED"
        )
        return {"mu": mu, "var": var, "status": status}

    @staticmethod
    def _count_from_node(node: DistributionNode, percentage: float) -> int:
        status = node["status"]
        mu = float(node["mu"])
        if status == "INVALID" or mu <= 0:
            return 0
        if status == "FIXED" or float(node["var"]) <= 0:
            return max(0, int(round(mu)))

        percentile = min(max(percentage, 0.0), 100.0) / 100.0
        sigma = max(float(np.sqrt(float(node["var"]))), 1.0)
        value = float(norm.ppf(percentile, loc=mu, scale=sigma))
        return max(0, int(round(value)))

    # ------------------------------------------------------------------
    # 築年数区分・建物選定
    # ------------------------------------------------------------------

    @staticmethod
    def _build_range_order_map(
        selected_ranges: List[selectedRange],
        app_state_year: int,
    ) -> Dict[int, int]:
        id_dict: Dict[int, int] = {}
        for selected_range in selected_ranges:
            if selected_range.period["end"] <= app_state_year - 5:
                continue
            for building_id in selected_range.models:
                id_dict[building_id] = selected_range.order
        return id_dict

    @staticmethod
    def _collect_eligible_buildings(
        params: List[Model3D],
        id_dict: Dict[int, int],
    ) -> List[Model3D]:
        return [
            param
            for param in params
            if param.show and id_dict.get(param.id) != 1
        ]

    def _count_by_category(
        self,
        params: List[Model3D],
        app_state_year: int,
    ) -> List[int]:
        counts = [0] * self.CATEGORY_COUNT
        for param in params:
            category_index = self._category_index_of(param, app_state_year)
            if category_index is None:
                continue
            counts[category_index] += 1
        return counts

    def _group_by_category(
        self,
        params: List[Model3D],
        app_state_year: int,
    ) -> List[List[Model3D]]:
        grouped: List[List[Model3D]] = [[] for _ in range(self.CATEGORY_COUNT)]
        for param in params:
            category_index = self._category_index_of(param, app_state_year)
            if category_index is None:
                continue
            grouped[category_index].append(param)
        return grouped

    def _pick_delete_ids(
        self,
        eligible_params: List[Model3D],
        app_state_year: int,
        delete_by_category: List[int],
    ) -> List[int]:
        grouped = self._group_by_category(eligible_params, app_state_year)
        delete_ids: List[int] = []
        for category_index, delete_count in enumerate(delete_by_category):
            if delete_count <= 0:
                continue
            candidates = grouped[category_index]
            if not candidates:
                continue
            sample_size = min(delete_count, len(candidates))
            delete_ids.extend(param.id for param in random.sample(candidates, sample_size))
        return delete_ids

    @staticmethod
    def _build_new_models(
        add_by_category: List[int],
        target_year: int,
        region: str,
    ) -> List[Model3D]:
        _ = (add_by_category, target_year, region)
        # TODO: add_by_category に基づき区分別の新築 Model3D を生成
        return []

    # ------------------------------------------------------------------
    # 築年数ヘルパー
    # ------------------------------------------------------------------

    @classmethod
    def _category_index_of(
        cls,
        param: Model3D,
        app_state_year: int,
    ) -> Optional[int]:
        building_age = cls._building_age(param, app_state_year)
        if building_age is None:
            return None
        return cls._resolve_category_index(building_age)

    @staticmethod
    def _building_age(param: Model3D, app_state_year: int) -> Optional[int]:
        if param.year is None or param.year == 0:
            return None
        return app_state_year - 5 - param.year

    @staticmethod
    def _resolve_category_index(building_age: int) -> int:
        if building_age >= 46:
            return NewPredictionService.OVER46_INDEX
        if building_age <= 5:
            return 0
        return (building_age - 6) // 5 + 1

    @classmethod
    def _num_steps(cls, add_year: int) -> int:
        return max(1, add_year // cls.STEP_YEARS)

    @classmethod
    def _over46_contributor_indices(cls, num_steps: int) -> List[int]:
        return [
            source_index
            for source_index in range(cls.CATEGORY_COUNT)
            if source_index + num_steps >= cls.OVER46_INDEX
        ]

    @classmethod
    def _survival_path_to_target(cls, source_index: int, num_steps: int) -> float:
        product = 1.0
        current_category = source_index
        for _ in range(num_steps):
            rate_index = (
                cls.OVER46_INDEX
                if current_category >= cls.OVER46_INDEX
                else current_category
            )
            product *= cls.SURVIVAL_RATES[rate_index]
            current_category = min(current_category + 1, cls.OVER46_INDEX)
        return product

    # ------------------------------------------------------------------
    # ログ
    # ------------------------------------------------------------------

    def _log_header(
        self,
        current_counts: List[int],
        app_state_year: int,
        add_year: int,
        percentage: float,
    ) -> None:
        print("=== new_prediction シミュレーション ===")
        print(
            f"appStateYear={app_state_year}, addYear={add_year}, "
            f"percentage={percentage}, targetYear={app_state_year + add_year}"
        )
        print("初期区分別建物数:")
        for label, count in zip(self.CATEGORY_LABELS, current_counts):
            print(f"  {label}: {count}")
        num_steps = self._num_steps(add_year)
        print(f"シミュレーション: {num_steps} ステップ ({self.STEP_YEARS}年/ステップ)")

    def _log_summary(self, plan: NewPredictionPlan, add_year: int) -> None:
        num_steps = self._num_steps(add_year)
        over46 = self._over46_contributor_indices(num_steps)
        print("区分別予測建物数 (percentage パーセンタイル適用後):")
        for label, count, node in zip(
            self.CATEGORY_LABELS,
            plan.predicted_counts,
            plan.final_nodes,
        ):
            print(
                f"  {label}: {count} 棟 "
                f"(μ={float(node['mu']):.4f}, σ²={float(node['var']):.4f}, status={node['status']})"
            )

        print(
            f"区分別削除数の算出 (num_steps={num_steps}, "
            f"46~合流区分={[self.CATEGORY_LABELS[i] for i in over46]}):"
        )
        for source_index, current_count in enumerate(plan.current_counts):
            if current_count <= 0:
                continue
            if source_index not in over46:
                target_index = source_index + num_steps
                print(
                    f"  2026区分 {self.CATEGORY_LABELS[source_index]} → "
                    f"{self.CATEGORY_LABELS[target_index]}: current={current_count}, "
                    f"predicted={plan.predicted_counts[target_index]}, "
                    f"delete={plan.delete_by_category[source_index]}"
                )

        if over46:
            print(f"  46~ 分配: predicted={plan.predicted_counts[self.OVER46_INDEX]}")
            for source_index in over46:
                current_count = plan.current_counts[source_index]
                if current_count <= 0:
                    continue
                expected = current_count * self._survival_path_to_target(source_index, num_steps)
                print(
                    f"  2026区分 {self.CATEGORY_LABELS[source_index]} → 46~: "
                    f"current={current_count}, expected={expected:.2f}, "
                    f"delete={plan.delete_by_category[source_index]}"
                )

        print(f"区分別削除数(2026年時点区分): {plan.delete_by_category}")
        print(f"区分別新築数(add_num): {plan.add_by_category}")
        print(f"総削除数: {plan.delete_count}, 総新築数: {plan.add_count}")
        print("=== new_prediction シミュレーション終了 ===")
