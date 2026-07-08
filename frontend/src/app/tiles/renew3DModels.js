import { ShadowMode } from 'cesium';
import { getModelColor } from './getModelColor.js';
import { applyModelPayloadToEntity } from './modelDescription.js';

const findRenewModel = (renewModels, entity) => (
  renewModels.find((model) => model.name === entity.name)
  ?? renewModels.find((model) => model.id === entity.id)
);

export const renew3DModels = async (viewer, renewModels) => {
    viewer.entities.values.forEach(entity => {
        const renewModel = findRenewModel(renewModels, entity);
        if (!renewModel) return;

        applyModelPayloadToEntity(entity, renewModel);

        // ベースの年代色
        let color = getModelColor(renewModel.year);

        // 計算不能な建物は年代色を半透明にする
        if (renewModel.earthquake_uncomputable || renewModel.tsunami_uncomputable) {
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
