import { getModelColor } from './getModelColor.js';

export const renew3DModels = async (viewer, renewModels) => {
    console.log(renewModels);
    viewer.entities.values.forEach(entity => {
        const renewModel = renewModels.find(model => model.name === entity.name);
        if (renewModel) {
            entity.year = renewModel.year;
            entity.show = renewModel.show;
            entity.model.color = getModelColor(renewModel.year);
        }
    });
    return renewModels;
}