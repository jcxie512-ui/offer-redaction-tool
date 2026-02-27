// Test hybrid approach: Gemini identifies text, Tesseract provides positions
// Simulate what would happen in the browser

const Tesseract = require('tesseract.js');
const fs = require('fs');

const imagePath = 'C:/Users/1/Downloads/微信图片_20260225151140_424_1432.jpg';

// Simulated Gemini response (text only, no bounding boxes)
const geminiResult = {
  sensitive: [
    { text: 'Peng, Xinjin', type: '姓名' },
    { text: '1197460858@qq.com', type: '个人邮箱' },
    { text: 'Sylvie', type: '姓名' },
    { text: 'L46123111', type: '证件号' },
    { text: '1197460858@qq.com', type: '个人邮箱' },
  ]
};

async function main() {
  console.log('Running Tesseract OCR...');
  const worker = await Tesseract.createWorker('eng');
  const result = await worker.recognize(imagePath);
  await worker.terminate();
  const data = result.data;

  console.log('OCR result keys:', Object.keys(result));
  console.log('data keys:', Object.keys(data));
  console.log('OCR complete. Lines:', data.lines?.length, 'Words:', data.words?.length);
  console.log('\nOCR Lines:');
  for (const line of data.lines) {
    console.log('  "' + line.text.trim() + '"  y:' + line.bbox.y0 + '-' + line.bbox.y1);
  }

  console.log('\n=== Running matchGeminiToOCR ===');
  // Inline the matching function
  const regions = matchGeminiToOCR(geminiResult.sensitive, data);
  console.log('\nTotal regions:', regions.length);
  for (const r of regions) {
    console.log(`  [${r.type}] (${r.bbox.x0},${r.bbox.y0})-(${r.bbox.x1},${r.bbox.y1}) size:${r.bbox.x1-r.bbox.x0}x${r.bbox.y1-r.bbox.y0}`);
  }
}

function matchGeminiToOCR(sensitiveItems, ocrData) {
  const regions = [];
  const words = ocrData.words || [];
  const lines = ocrData.lines || [];

  for (const item of sensitiveItems) {
    const st = (item.text || '').trim();
    if (!st || st.length < 2) continue;
    const stLower = st.toLowerCase();
    const stClean = stLower.replace(/[^a-z0-9@.\u4e00-\u9fff]/gi, '');
    let matched = false;

    for (const line of lines) {
      const lineText = line.text || '';
      const lineLower = lineText.toLowerCase();
      const lineClean = lineLower.replace(/[^a-z0-9@.\u4e00-\u9fff]/gi, '');

      const directIdx = lineLower.indexOf(stLower);
      const cleanIdx = (directIdx === -1) ? lineClean.indexOf(stClean) : -1;
      if (directIdx === -1 && cleanIdx === -1) continue;

      const lineWords = line.words || [];
      if (lineWords.length === 0) continue;
      const matchWords = [];

      if (directIdx >= 0) {
        const matchStart = directIdx;
        const matchEnd = directIdx + stLower.length;
        let pos = 0;
        for (const w of lineWords) {
          const wText = w.text.toLowerCase();
          const wPos = lineLower.indexOf(wText, Math.max(0, pos - 3));
          if (wPos === -1) { pos += wText.length + 1; continue; }
          const wEnd = wPos + wText.length;
          if (wEnd > matchStart && wPos < matchEnd) {
            matchWords.push(w);
          }
          pos = wEnd;
        }
      } else {
        let remaining = stClean;
        for (const w of lineWords) {
          const wClean = w.text.toLowerCase().replace(/[^a-z0-9@.\u4e00-\u9fff]/gi, '');
          if (wClean.length < 2) continue;
          if (remaining.includes(wClean)) {
            matchWords.push(w);
            remaining = remaining.replace(wClean, '');
          }
        }
        if (remaining.length > stClean.length * 0.4) {
          matchWords.length = 0;
        }
      }

      if (matchWords.length > 0) {
        const bbox = {
          x0: Math.min(...matchWords.map(w => w.bbox.x0)),
          y0: Math.min(...matchWords.map(w => w.bbox.y0)),
          x1: Math.max(...matchWords.map(w => w.bbox.x1)),
          y1: Math.max(...matchWords.map(w => w.bbox.y1)),
        };
        regions.push({ bbox, type: item.type || '敏感信息' });
        console.log('[MATCH]', item.type, '"' + st + '"',
          '→ words:', matchWords.map(w => '"' + w.text + '"').join(', '),
          '→ bbox:', bbox.x0 + ',' + bbox.y0 + '-' + bbox.x1 + ',' + bbox.y1);
        matched = true;
      }
    }

    if (!matched) {
      const stParts = st.split(/[\s,]+/).filter(p => p.length >= 2);
      const foundWords = [];
      for (const part of stParts) {
        const partLower = part.toLowerCase().replace(/[^a-z0-9@.\u4e00-\u9fff]/gi, '');
        if (partLower.length < 2) continue;
        for (const w of words) {
          const wClean = w.text.toLowerCase().replace(/[^a-z0-9@.\u4e00-\u9fff]/gi, '');
          if (wClean === partLower || (partLower.length >= 4 && wClean.includes(partLower)) || (wClean.length >= 4 && partLower.includes(wClean))) {
            foundWords.push(w);
          }
        }
      }
      if (foundWords.length >= Math.max(1, Math.ceil(stParts.length * 0.6))) {
        for (const w of foundWords) {
          const bbox = { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 };
          regions.push({ bbox, type: item.type });
          console.log('[WORD-MATCH]', item.type, '"' + st + '" → word:"' + w.text + '"',
            'bbox:', bbox.x0 + ',' + bbox.y0 + '-' + bbox.x1 + ',' + bbox.y1);
          matched = true;
        }
      }
    }

    if (!matched) {
      console.log('[MISS]', item.type, '"' + st + '"');
    }
  }
  return regions;
}

main().catch(e => console.error(e));
