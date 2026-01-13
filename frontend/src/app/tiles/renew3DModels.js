import { getModelColor } from './getModelColor.js';

export const renew3DModels = async (viewer, renewModels) => {
    console.log(renewModels);
    viewer.entities.values.forEach(entity => {
        const renewModel = renewModels.find(model => model.name === entity.name);
        if (renewModel) {
            entity.year = renewModel.year;
            entity.show = renewModel.show;
            
            // GLTFモデルの場合（modelプロパティが存在）
            if (entity.model) {
                entity.model.color = getModelColor(renewModel.year);
            }
            // CityGMLのpolygonの場合
            else if (entity.polygon) {
                entity.polygon.material = getModelColor(renewModel.year);
            }
            // CityGMLのboxの場合
            else if (entity.box) {
                entity.box.material = getModelColor(renewModel.year);
            }
        }
    });
    return renewModels;
}