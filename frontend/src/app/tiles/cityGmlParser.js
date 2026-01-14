/**
 * CityGMLファイルをパースして建物データを抽出する
 */

/**
 * XML文字列をパースしてDocumentオブジェクトに変換
 * @param {string} xmlString - XML文字列
 * @returns {Document} - パースされたXML Document
 */
const NS = {
  gml: 'http://www.opengis.net/gml',
  bldg: 'http://www.opengis.net/citygml/building/2.0',
  gen09: 'http://www.opengis.net/citygml/generics/0.9',
  gen20: 'http://www.opengis.net/citygml/generics/2.0',
  uro: 'http://www.opengis.net/citygml/uro/2.0',
  core: 'http://www.opengis.net/citygml/2.0',
};

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

// 指定したlocalNameを持つ最初の子孫要素のテキストを取得（名前空間に依存しない）
function findFirstTextByLocalName(parent, localName) {
  const all = parent.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === localName) {
      const text = getTextContent(all[i]);
      if (text) return text;
    }
  }
  return null;
}

// 名前空間候補とlocalNameから最初のテキストを取得
function getFirstTextByNS(parent, namespaces, localName) {
  const nsList = Array.isArray(namespaces) ? namespaces : [namespaces];
  for (const ns of nsList) {
    const els = getElementsByNS(parent, ns, localName);
    if (els.length > 0) {
      const text = getTextContent(els[0]);
      if (text) return text;
    }
  }
  return null;
}

// gen:stringAttribute など name属性を持つ属性要素を抽出
function getGenericAttribute(parent, targetName) {
  const candidates = [NS.gen20, NS.gen09];
  for (const ns of candidates) {
    const attrs = getElementsByNS(parent, ns, 'stringAttribute');
    for (const attr of attrs) {
      if (attr.getAttribute('name') === targetName) {
        const valEl = attr.getElementsByTagName('*');
        for (let i = 0; i < valEl.length; i++) {
          if (valEl[i].localName === 'value') {
            const text = getTextContent(valEl[i]);
            if (text) return text;
          }
        }
      }
    }
  }
  return null;
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
  
  // 3D座標または2D座標に対応
  const dimension = posListElement.getAttribute('srsDimension') || '3';
  const dim = parseInt(dimension);
  
  // PLATEAUの札幌CityGMLでは座標順が「緯度, 経度, 高度」となっているため
  // 無条件で coord1=緯度, coord2=経度 とみなし、経度=coord2, 緯度=coord1 にマッピングする
  for (let i = 0; i < coords.length; i += dim) {
    if (i + 1 < coords.length) {
      const lat = coords[i];       // 緯度
      const lon = coords[i + 1];   // 経度
      const alt = dim >= 3 && i + 2 < coords.length ? coords[i + 2] : 0;
      
      positions.push({ lon, lat, alt });
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
    year: null,
    usage: null,
    height: null,
    storeysAboveGround: null,
    positions: [],
    center: null,
    attributes: {},
    geometry: {}
  };
  
  // 実際に使用される情報のみを取得（処理を軽量化）
  
  // 分類・用途
  building.usage = getFirstTextByNS(buildingElement, NS.bldg, 'usage') || null;

  // 建築年
  const yearText = getFirstTextByNS(buildingElement, NS.bldg, 'yearOfConstruction');
  if (yearText) building.year = parseInt(yearText);

  // 高さ
  const heightText = getFirstTextByNS(buildingElement, NS.bldg, 'measuredHeight');
  if (heightText) building.height = parseFloat(heightText);

  // 階数（地上階数のみ）
  const storeysAG = getFirstTextByNS(buildingElement, NS.bldg, 'storeysAboveGround');
  if (storeysAG) building.storeysAboveGround = parseInt(storeysAG);

  // 実際に使用される属性のみを取得
  const buildingFootprintArea = parseFloat(findFirstTextByLocalName(buildingElement, 'buildingFootprintArea'));
  const totalFloorArea = parseFloat(findFirstTextByLocalName(buildingElement, 'totalFloorArea'));
  const buildingHeight = parseFloat(findFirstTextByLocalName(buildingElement, 'buildingHeight'));
  const buildingStructureType = findFirstTextByLocalName(buildingElement, 'buildingStructureType');
  
  if (buildingFootprintArea != null && !isNaN(buildingFootprintArea)) {
    building.attributes.buildingFootprintArea = buildingFootprintArea;
  }
  if (totalFloorArea != null && !isNaN(totalFloorArea)) {
    building.attributes.totalFloorArea = totalFloorArea;
  }
  if (buildingHeight != null && !isNaN(buildingHeight)) {
    building.attributes.buildingHeight = buildingHeight;
  }
  if (buildingStructureType) {
    building.attributes.buildingStructureType = buildingStructureType;
  }

  // 建物のジオメトリを取得（bldg:lod0RoofEdgeを優先）
  // LOD0の屋根端線を優先的に取得
  const lod0RoofEdge = getElementsByNS(buildingElement, NS.bldg, 'lod0RoofEdge');
  if (lod0RoofEdge.length > 0) {
    const posLists = getElementsByNS(lod0RoofEdge[0], NS.gml, 'posList');
    if (posLists.length > 0) {
      const lod0Positions = parsePosList(posLists[0]);
      if (lod0Positions.length >= 3) {
        building.geometry.lod0RoofEdge = lod0Positions;
        // LOD0から中心座標を計算（優先）
        building.center = calculateCenter(lod0Positions);
        building.positions = lod0Positions;
      }
    }
  }

  // LOD0がない場合のみ、LOD1,2,3のSolidから座標を取得（フォールバック）
  if (!building.center || !building.geometry.lod0RoofEdge) {
    const lod1Solid = getElementsByNS(buildingElement, NS.bldg, 'lod1Solid');
    const lod2Solid = getElementsByNS(buildingElement, NS.bldg, 'lod2Solid');
    const lod3Solid = getElementsByNS(buildingElement, NS.bldg, 'lod3Solid');
    
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
      const posListElements = getElementsByNS(solidElement, NS.gml, 'posList');
      if (posListElements.length > 0) {
        const positions = parsePosList(posListElements[0]);
        building.positions = positions;
        building.center = calculateCenter(positions);
        building.geometry.solid = positions;
      }
    }
  }

  // 注: lod2MultiSurfaceやその他の属性は使用されていないため、取得をスキップして処理を軽量化
  
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

/* ============================================
 * 以下は処理軽量化のため削除した属性取得処理
 * 将来必要になった場合はコメントを外して使用可能
 * ============================================

// 削除した属性の取得処理（参考用）
function parseBuilding_OLD_ATTRIBUTES(buildingElement) {
  // 基本識別情報
  addAttr('buildingID', getFirstTextByNS(buildingElement, NS.uro, 'buildingID'));
  addAttr('creationDate', getFirstTextByNS(buildingElement, [NS.core, NS.bldg], 'creationDate'));
  addAttr('keyCode', getGenericAttribute(buildingElement, 'KeyCode'));

  // gml:name を取得
  const nameElements = getElementsByNS(buildingElement, NS.gml, 'name');
  if (nameElements.length > 0) {
    building.name = getTextContent(nameElements[0]);
  }

  // 分類・用途
  addAttr('class', getFirstTextByNS(buildingElement, NS.bldg, 'class'));
  addAttr('usage', building.usage);

  // 階数（地下階数）
  const storeysBG = getFirstTextByNS(buildingElement, NS.bldg, 'storeysBelowGround');
  if (storeysBG) building.storeysBelowGround = parseInt(storeysBG);

  // 詳細属性（uro:buildingDetailAttribute配下など）
  addAttr('siteArea', parseFloat(findFirstTextByLocalName(buildingElement, 'siteArea')));
  addAttr('fireproofStructureType', findFirstTextByLocalName(buildingElement, 'fireproofStructureType'));
  addAttr('districtsAndZonesType', findFirstTextByLocalName(buildingElement, 'districtsAndZonesType'));
  addAttr('orgUsage2', findFirstTextByLocalName(buildingElement, 'orgUsage2'));
  addAttr('specifiedBuildingCoverageRate', parseFloat(findFirstTextByLocalName(buildingElement, 'specifiedBuildingCoverageRate')));
  addAttr('specifiedFloorAreaRate', parseFloat(findFirstTextByLocalName(buildingElement, 'specifiedFloorAreaRate')));
  addAttr('surveyYear', parseInt(findFirstTextByLocalName(buildingElement, 'surveyYear')));

  // 位置・行政
  addAttr('prefecture', findFirstTextByLocalName(buildingElement, 'prefecture'));
  addAttr('city', findFirstTextByLocalName(buildingElement, 'city'));

  // データ品質
  addAttr('geometrySrcDescLod0', findFirstTextByLocalName(buildingElement, 'geometrySrcDescLod0'));
  addAttr('geometrySrcDescLod1', findFirstTextByLocalName(buildingElement, 'geometrySrcDescLod1'));
  addAttr('geometrySrcDescLod2', findFirstTextByLocalName(buildingElement, 'geometrySrcDescLod2'));
  addAttr('thematicSrcDesc', findFirstTextByLocalName(buildingElement, 'thematicSrcDesc'));
  addAttr('lod1HeightType', findFirstTextByLocalName(buildingElement, 'lod1HeightType'));
  addAttr('srcScaleLod0', findFirstTextByLocalName(buildingElement, 'srcScaleLod0'));
  addAttr('srcScaleLod1', findFirstTextByLocalName(buildingElement, 'srcScaleLod1'));

  // 拡張属性 (uro:bldgKeyValuePairAttribute)
  const kvPairs = [];
  const allNodes = buildingElement.getElementsByTagName('*');
  for (let i = 0; i < allNodes.length; i++) {
    const el = allNodes[i];
    if (el.localName === 'bldgKeyValuePairAttribute') {
      const key = findFirstTextByLocalName(el, 'key');
      const value = findFirstTextByLocalName(el, 'codeValue');
      if (key || value) kvPairs.push({ key, value });
    }
  }
  if (kvPairs.length > 0) building.attributes.keyValuePairs = kvPairs;

  // lod2MultiSurface
  const lod2MultiSurface = getElementsByNS(buildingElement, NS.bldg, 'lod2MultiSurface');
  if (lod2MultiSurface.length > 0) {
    const posListElements = getElementsByNS(lod2MultiSurface[0], NS.gml, 'posList');
    if (posListElements.length > 0) {
      building.geometry.lod2MultiSurface = parsePosList(posListElements[0]);
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
}

*/
