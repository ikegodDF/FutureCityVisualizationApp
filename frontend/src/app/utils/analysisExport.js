// JSON出力関数（元の関数）
export const analysisExportJSON = (filename, dataObject) => {
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
        console.error('analysisExportJSON error:', e);
    }
}

// CSV出力関数
export const analysisExportCSV = (filename, dataArray) => {
    try {
        // dataArray は [[2246, 1859, ...], [2246, 1859, ...], [2246, 1859, ...]] の形式
        // これをCSVフォーマットに変換
        
        // ヘッダー行を作成
        const headers = ['試行回', '0年', '5年', '10年', '15年', '20年', '25年'];
        
        // データ行を作成
        const rows = dataArray.map((runData, index) => {
            const row = [`試行${index + 1}`, ...runData];
            return row.map(cell => `"${cell}"`).join(',');
        });
        
        // CSV全体を作成
        const csvContent = [
            headers.map(h => `"${h}"`).join(','),
            ...rows
        ].join('\n');
        
        // BOMを追加してUTF-8で出力（Excelでの文字化けを防ぐ）
        const bom = '\uFEFF';
        const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error('analysisExportCSV error:', e);
    }
}