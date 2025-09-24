import { Cesium3DTileset } from 'cesium';

export async function loadCityTiles(viewer, url) {
  const tileset = await Cesium3DTileset.fromUrl(url);
  viewer.scene.primitives.add(tileset);
  return tileset;
}


