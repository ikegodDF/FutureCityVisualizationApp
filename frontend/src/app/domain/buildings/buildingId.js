/**
 * 建物 ID の解決・採番ユーティリティ。
 * 初期 GLTF 建物と同じく数値 id + `model_{id}` 名称を使う。
 */

export function resolveBuildingId(source) {
  if (source == null) {
    return null;
  }

  const rawId = source.id;
  if (typeof rawId === 'number' && Number.isFinite(rawId) && rawId > 0) {
    return rawId;
  }

  if (typeof rawId === 'string') {
    const fromRawId = Number(rawId);
    if (Number.isFinite(fromRawId) && fromRawId > 0) {
      return fromRawId;
    }

    const fromModelPrefix = Number(rawId.replace(/^model_/, ''));
    if (Number.isFinite(fromModelPrefix) && fromModelPrefix > 0) {
      return fromModelPrefix;
    }
  }

  const fromName = Number(String(source.name ?? '').replace(/^model_/, ''));
  if (Number.isFinite(fromName) && fromName > 0) {
    return fromName;
  }

  return null;
}

export function getMaxBuildingId(sources = []) {
  return sources.reduce((maxId, source) => {
    const id = resolveBuildingId(source);
    return id != null ? Math.max(maxId, id) : maxId;
  }, 0);
}

export function createBuildingIdAllocator(sources = []) {
  let nextId = getMaxBuildingId(sources);

  return {
    next() {
      nextId += 1;
      return nextId;
    },
    peek() {
      return nextId + 1;
    },
    currentMax() {
      return nextId;
    },
  };
}

export function toModelName(id) {
  return `model_${id}`;
}
