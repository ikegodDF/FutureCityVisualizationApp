/** @typedef {'earthquake'|'tsunami'} DistributionMode */

/**
 * 分布スケール定義。
 * 色は addDistribution.js の getSindoColor / getTsunamiColor と一致させる。
 */
export const DISTRIBUTION_MODES = {
  earthquake: {
    title: '震度スケール',
    renderMode: 'earthquake',
    items: [
      ['#A0F080', '震度1'],
      ['#00D000', '震度2'],
      ['#1040FF', '震度3'],
      ['#FFFF00', '震度4'],
      ['#FFD700', '震度5弱'],
      ['#FF9900', '震度5強'],
      ['#FF3300', '震度6弱'],
      ['#99001A', '震度6強'],
      ['#4A0010', '震度7'],
    ],
  },
  tsunami: {
    title: '浸水深スケール',
    renderMode: 'tsunami',
    items: [
      ['#A0F080', '～0.01m'],
      ['#00D000', '0.01～0.3m'],
      ['#1040FF', '0.3～1.0m'],
      ['#FFFF00', '1.0m～2.0m'],
      ['#FFD700', '2.0～4.0m'],
      ['#FF9900', '4.0～6.0m'],
      ['#FF3300', '6.0～8.0m'],
      ['#99001A', '8.0～10.0m'],
      ['#4A0010', '10.0m～'],
    ],
  },
};

/** 分布取得ボタンで表示する種別。震度に切り替えるときはここだけ変更 */
export const ACTIVE_DISTRIBUTION_MODE = 'tsunami';

export function getDistributionRenderMode(mode = ACTIVE_DISTRIBUTION_MODE) {
  return DISTRIBUTION_MODES[mode]?.renderMode ?? mode;
}
