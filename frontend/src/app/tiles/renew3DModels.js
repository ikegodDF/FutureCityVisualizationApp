import { Color } from 'cesium';
import { getModelColor } from './getModelColor.js';

export const renew3DModels = async (viewer, renewModels) => {
    console.log(renewModels);
    viewer.entities.values.forEach(entity => {
        const renewModel = renewModels.find(model => model.name === entity.name);
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
}