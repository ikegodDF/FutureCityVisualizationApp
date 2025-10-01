import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function prepareCesium() {
  const sourceDir = path.join(__dirname, '../node_modules/cesium/Build/Cesium');
  const targetDir = path.join(__dirname, '../public/cesium');
  
  try {
    // 既存のディレクトリを削除
    if (fs.existsSync(targetDir)) {
      await fs.remove(targetDir);
    }
    
    // ディレクトリを作成
    await fs.ensureDir(targetDir);
    
    // 必要なディレクトリをコピー
    const dirsToCopy = ['Assets', 'ThirdParty', 'Widgets', 'Workers'];
    
    for (const dir of dirsToCopy) {
      const sourcePath = path.join(sourceDir, dir);
      const targetPath = path.join(targetDir, dir);
      
      if (fs.existsSync(sourcePath)) {
        await fs.copy(sourcePath, targetPath);
        console.log(`✓ Copied ${dir}`);
      } else {
        console.warn(`⚠ ${dir} not found in ${sourcePath}`);
      }
    }
    
    console.log('✓ Cesium preparation completed');
  } catch (error) {
    console.error('✗ Error preparing Cesium:', error);
    process.exit(1);
  }
}

prepareCesium();
