
export const createModelYear = () => {
    return Math.round(truncatedNormal(1986.638197, 15.64999934, 1920, 2024))

}

export const createModelUsage = () => {

}

export const createModelStructureType = () => {

}

export const createModelArea = () => {

}

export const createModelHeight = () => {

}

const truncatedNormal = (mean, std, min, max) => {
    // 標準正規分布の累積分布関数 (CDF) の近似
    function cdf(x) {
        return 0.5 * (1 + erf((x - mean) / (std * Math.sqrt(2))));
    }

    // 誤差関数 (erf) の近似実装
    function erf(x) {
        const sign = (x >= 0) ? 1 : -1;
        x = Math.abs(x);
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p = 0.3275911;
        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        return sign * y;
    }

    // 逆誤差関数 (erfinv) の近似実装
    function erfinv(x) {
        const a = 0.147;
        const l = Math.log(1 - x * x);
        const part1 = 2 / (Math.PI * a) + l / 2;
        const part2 = l / a;
        return Math.sign(x) * Math.sqrt(Math.sqrt(part1 * part1 - part2) - part1);
    }

    // [min, max] の範囲を累積分布の [pMin, pMax] に変換
    const pMin = cdf(min);
    const pMax = cdf(max);

    // [pMin, pMax] の範囲で一様乱数を生成
    const p = Math.random() * (pMax - pMin) + pMin;

    // 逆関数を用いて値を算出
    return mean + std * Math.sqrt(2) * erfinv(2 * p - 1);
}