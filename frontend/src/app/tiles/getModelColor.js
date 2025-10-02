import { Color } from 'cesium';

export const getModelColor = (year) => {
    const currentYear = new Date().getFullYear();
    const age = currentYear - year;

    if (age < 6) {
        return Color.fromCssColorString('#8BC34A');
    } else if (age < 16) {
        return Color.fromCssColorString('#A5D6A7');
    } else if (age < 26) {
        return Color.fromCssColorString('#FFEB3B');
    } else if (age < 36) {
        return Color.fromCssColorString('#FF9800');
    } else if (age < 46) {
        return Color.fromCssColorString('#F44336');
    } else if (age < 2000) {
        return Color.fromCssColorString('#B71C1C');
    } else {
        return Color.fromCssColorString('#1976D2');
    }
}


