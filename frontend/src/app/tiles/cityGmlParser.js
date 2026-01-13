/**
 * CityGMLファイルをパースして建物データを抽出する
 */

/**
 * XML文字列をパースしてDocumentオブジェクトに変換
 * @param {string} xmlString - XML文字列
 * @returns {Document} - パースされたXML Document
 */
function parseXML(xmlString) {
  const parser = new DOMParser();
  return parser.parseFromString(xmlString, 'text/xml');
}

/**
 * 名前空間付きの要素を取得
 * @param {Element} parent - 親要素
 * @param {string} namespace - 名前空間URI
 * @param {string} localName - ローカル名
 * @returns {NodeList} - 一致する要素のリスト
 */
function getElementsByNS(parent, namespace, localName) {
  const elements = [];
  const allElements = parent.getElementsByTagName('*');
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    if (el.namespaceURI === namespace && el.localName === localName) {
      elements.push(el);
    }
  }
  return elements;
}

/**
 * テキストコンテンツを取得
 * @param {Element} element - 要素
 * @returns {string} - テキストコンテンツ
 */
function getTextContent(element) {
  if (!element) return null;
  return element.textContent?.trim() || null;
}

/**
 * GML座標文字列をパース（"lon lat alt" または "lon,lat,alt" 形式）
 * @param {string} posString - 座標文字列
 * @returns {Array<number>} - [経度, 緯度, 高度]
 */
function parseGMLPosition(posString) {
  if (!posString) return null;
  
  // カンマ区切りまたはスペース区切りに対応
  const coords = posString.split(/[,\s]+/).map(Number).filter(n => !isNaN(n));
  if (coords.length >= 2) {
    return {
      lon: coords[0],
      lat: coords[1],
      alt: coords[2] || 0
    };
  }
  return null;
}

/**
 * GML:posListから座標配列を取得
 * @param {Element} posListElement - gml:posList要素
 * @returns {Array<{lon: number, lat: number, alt: number}>} - 座標配列
 */
function parsePosList(posListElement) {
  if (!posListElement) return [];
  
  const text = getTextContent(posListElement);
  if (!text) return [];
  
  const coords = text.trim().split(/\s+/).map(Number);
  const positions = [];
  
  // 3D座標（lon lat alt）または2D座標（lon lat）に対応
  const dimension = posListElement.getAttribute('srsDimension') || '3';
  const dim = parseInt(dimension);
  
  for (let i = 0; i < coords.length; i += dim) {
    if (i + 1 < coords.length) {
      positions.push({
        lon: coords[i],
        lat: coords[i + 1],
        alt: dim >= 3 && i + 2 < coords.length ? coords[i + 2] : 0
      });
    }
  }
  
  return positions;
}

/**
 * 建物の中心座標を計算
 * @param {Array<{lon: number, lat: number, alt: number}>} positions - 座標配列
 * @returns {{lon: number, lat: number, alt: number}} - 中心座標
 */
function calculateCenter(positions) {
  if (positions.length === 0) return { lon: 0, lat: 0, alt: 0 };
  
  const sum = positions.reduce((acc, pos) => ({
    lon: acc.lon + pos.lon,
    lat: acc.lat + pos.lat,
    alt: acc.alt + pos.alt
  }), { lon: 0, lat: 0, alt: 0 });
  
  return {
    lon: sum.lon / positions.length,
    lat: sum.lat / positions.length,
    alt: sum.alt / positions.length
  };
}

/**
 * CityGMLの建物（bldg:Building）をパース
 * @param {Element} buildingElement - bldg:Building要素
 * @returns {Object|null} - 建物データ
 */
function parseBuilding(buildingElement) {
  if (!buildingElement) return null;
  
  const building = {
    id: buildingElement.getAttribute('gml:id') || null,
    name: null,
    year: null,
    usage: null,
    height: null,
    storeysAboveGround: null,
    positions: [],
    center: null,
    attributes: {}
  };
  
  // gml:name を取得
  const nameElements = getElementsByNS(buildingElement, 'http://www.opengis.net/gml', 'name');
  if (nameElements.length > 0) {
    building.name = getTextContent(nameElements[0]);
  }
  
  // 建物の属性情報を取得（core:cityObjectMember/bldg:Building/bldg:function など）
  const functionElements = getElementsByNS(buildingElement, 'http://www.opengis.net/citygml/building/2.0', 'function');
  if (functionElements.length > 0) {
    building.usage = getTextContent(functionElements[0]);
  }
  
  // 建築年を取得（bldg:yearOfConstruction）
  const yearElements = getElementsByNS(buildingElement, 'http://www.opengis.net/citygml/building/2.0', 'yearOfConstruction');
  if (yearElements.length > 0) {
    const yearText = getTextContent(yearElements[0]);
    if (yearText) {
      building.year = parseInt(yearText);
    }
  }
  
  // 建物の高さを取得（bldg:measuredHeight）
  const heightElements = getElementsByNS(buildingElement, 'http://www.opengis.net/citygml/building/2.0', 'measuredHeight');
  if (heightElements.length > 0) {
    const heightText = getTextContent(heightElements[0]);
    if (heightText) {
      building.height = parseFloat(heightText);
    }
  }
  
  // 階数を取得（bldg:storeysAboveGround）
  const storeysElements = getElementsByNS(buildingElement, 'http://www.opengis.net/citygml/building/2.0', 'storeysAboveGround');
  if (storeysElements.length > 0) {
    const storeysText = getTextContent(storeysElements[0]);
    if (storeysText) {
      building.storeysAboveGround = parseInt(storeysText);
    }
  }
  
  // 建物のジオメトリを取得（bldg:lod1Solid, bldg:lod2Solid など）
  const lod1Solid = getElementsByNS(buildingElement, 'http://www.opengis.net/citygml/building/2.0', 'lod1Solid');
  const lod2Solid = getElementsByNS(buildingElement, 'http://www.opengis.net/citygml/building/2.0', 'lod2Solid');
  const lod3Solid = getElementsByNS(buildingElement, 'http://www.opengis.net/citygml/building/2.0', 'lod3Solid');
  
  // より詳細なLODを優先
  let solidElement = null;
  if (lod3Solid.length > 0) {
    solidElement = lod3Solid[0];
  } else if (lod2Solid.length > 0) {
    solidElement = lod2Solid[0];
  } else if (lod1Solid.length > 0) {
    solidElement = lod1Solid[0];
  }
  
  // Solidから座標を抽出
  if (solidElement) {
    // gml:Solid/gml:exterior/gml:CompositeSurface/gml:surfaceMember/gml:Polygon/gml:exterior/gml:LinearRing/gml:posList
    const posListElements = getElementsByNS(solidElement, 'http://www.opengis.net/gml', 'posList');
    if (posListElements.length > 0) {
      // 最初のposListから座標を取得（建物の底面）
      const positions = parsePosList(posListElements[0]);
      building.positions = positions;
      building.center = calculateCenter(positions);
    }
  }
  
  // その他の属性を取得
  const genericAttributes = getElementsByNS(buildingElement, 'http://www.opengis.net/citygml/generics/0.9', 'stringAttribute');
  genericAttributes.forEach(attr => {
    const attrName = attr.getAttribute('name');
    const attrValue = getTextContent(attr.querySelector('gen:value'));
    if (attrName && attrValue) {
      building.attributes[attrName] = attrValue;
    }
  });
  
  return building;
}

/**
 * CityGMLファイルをパースして建物データの配列を返す
 * @param {string} cityGmlContent - CityGMLファイルの内容（XML文字列）
 * @returns {Array<Object>} - 建物データの配列
 */
export function parseCityGML(cityGmlContent) {
  try {
    const xmlDoc = parseXML(cityGmlContent);
    
    // パースエラーをチェック
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error('XMLパースエラー: ' + parserError.textContent);
    }
    
    const buildings = [];
    
    // core:cityObjectMember/bldg:Building を検索
    // 名前空間を考慮して検索
    const allElements = xmlDoc.getElementsByTagName('*');
    const buildingElements = [];
    
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i];
      // bldg:Building要素を検索（名前空間は異なる可能性があるため、localNameで判定）
      // PLATEAUのCityGMLでは "Building" というローカル名を持つ要素を検索
      if (el.localName === 'Building' || 
          el.tagName.includes('Building') ||
          (el.tagName && el.tagName.toLowerCase().includes('building'))) {
        // 親要素がcityObjectMemberであることを確認（オプション）
        buildingElements.push(el);
      }
    }
    
    // 各建物をパース
    buildingElements.forEach(buildingElement => {
      const building = parseBuilding(buildingElement);
      if (building && building.center) {
        buildings.push(building);
      }
    });
    
    return buildings;
  } catch (error) {
    console.error('CityGMLパースエラー:', error);
    throw error;
  }
}

/**
 * CityGMLファイルをURLから読み込んでパース
 * @param {string} url - CityGMLファイルのURL
 * @returns {Promise<Array<Object>>} - 建物データの配列
 */
export async function loadCityGMLFromURL(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`CityGMLファイルの読み込みに失敗: ${response.statusText}`);
    }
    const cityGmlContent = await response.text();
    return parseCityGML(cityGmlContent);
  } catch (error) {
    console.error('CityGML読み込みエラー:', error);
    throw error;
  }
}

