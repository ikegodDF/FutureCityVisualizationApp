export function exportResult(filename, dataObject) {
  try {
    const json = JSON.stringify(dataObject, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('exportResult error:', e);
  }
}

// appState.result に含まれる循環参照やCesiumオブジェクトを排除して
// name/year/show のみのシリアライズ可能な構造へ変換
export function buildSerializableResult(result) {
  const output = {};
  if (!result || typeof result !== 'object') return output;

  for (const [policy, years] of Object.entries(result)) {
    if (!years || typeof years !== 'object') continue;
    output[policy] = {};
    for (const [year, disasters] of Object.entries(years)) {
      if (!disasters || typeof disasters !== 'object') continue;
      output[policy][year] = {};
      for (const [disaster, models] of Object.entries(disasters)) {
        if (!Array.isArray(models)) continue;
        output[policy][year][disaster] = models.map((m) => {
          if (m && typeof m === 'object') {
            return {
              name: m.name,
              year: m.year,
              show: m.show,
            };
          }
          return m;
        });
      }
    }
  }

  return output;
}

export function exportResultSerializable(filename, result) {
  const serializable = buildSerializableResult(result);
  return exportResult(filename, serializable);
}


