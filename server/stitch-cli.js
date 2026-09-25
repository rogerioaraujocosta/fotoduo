const path = require('path');
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  try {
    sharp = require(path.join(__dirname, '..', 'node_modules', 'sharp'));
  } catch (e2) {
    console.error('Falha ao localizar sharp:', e2);
    process.exit(1);
  }
}

const fs = require('fs');
const path = require('path');
const os = require('os');

function escapeXml(unsafe) {
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

async function stitch(imagePaths, options, targetFilePath) {
  if (!imagePaths || imagePaths.length === 0) {
    throw new Error('Nenhuma imagem selecionada para montagem.');
  }

  const processedImages = [];

  for (const imgPath of imagePaths) {
    const originalMeta = await sharp(imgPath).metadata();
    const origW = originalMeta.width || 800;
    const origH = originalMeta.height || 600;

    const cropTop = Math.max(0, Math.min(options.cropTop || 0, origH - 40));
    const cropBottom = Math.max(0, Math.min(options.cropBottom || 0, origH - cropTop - 20));
    const cropLeft = Math.max(0, Math.min(options.cropLeft || 0, origW - 40));
    const cropRight = Math.max(0, Math.min(options.cropRight || 0, origW - cropLeft - 20));

    const extractW = origW - cropLeft - cropRight;
    const extractH = origH - cropTop - cropBottom;

    const buf = await sharp(imgPath)
      .extract({
        left: cropLeft,
        top: cropTop,
        width: extractW,
        height: extractH,
      })
      .png()
      .toBuffer();

    processedImages.push({
      buffer: buf,
      width: extractW,
      height: extractH,
    });
  }

  const isVertical = options.layout !== 'horizontal';
  let totalContentWidth = 0;
  let totalContentHeight = 0;
  const gap = typeof options.gap === 'number' ? options.gap : 16;

  if (isVertical) {
    totalContentWidth = Math.max(...processedImages.map(img => img.width));
    totalContentHeight = processedImages.reduce((sum, img) => sum + img.height, 0) + 
      (processedImages.length - 1) * gap;
  } else {
    totalContentWidth = processedImages.reduce((sum, img) => sum + img.width, 0) + 
      (processedImages.length - 1) * gap;
    totalContentHeight = Math.max(...processedImages.map(img => img.height));
  }

  let titleHeight = 0;
  let titleSvgBuffer = null;

  if (options.title && options.title.trim()) {
    titleHeight = 84;
    const cleanTitle = escapeXml(options.title.trim());
    const svgStr = `
      <svg width="${totalContentWidth}" height="${titleHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#0f172a;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#1e293b;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${totalContentWidth}" height="${titleHeight}" fill="url(#grad)" rx="10"/>
        <circle cx="36" cy="42" r="16" fill="#0284c7" fill-opacity="0.3"/>
        <text x="31" y="48" font-family="Segoe UI, sans-serif" font-size="18" font-weight="bold" fill="#38bdf8">FD</text>
        <text x="68" y="49" font-family="Segoe UI, -apple-system, Roboto, sans-serif" font-size="26" font-weight="bold" fill="#ffffff">${cleanTitle}</text>
      </svg>
    `;
    titleSvgBuffer = Buffer.from(svgStr);
    totalContentHeight += titleHeight + gap;
  }

  const compositeList = [];
  let currentY = 0;

  if (titleSvgBuffer) {
    compositeList.push({
      input: titleSvgBuffer,
      top: 0,
      left: 0,
    });
    currentY += titleHeight + gap;
  }

  let currentX = 0;

  for (let i = 0; i < processedImages.length; i++) {
    const img = processedImages[i];

    if (isVertical) {
      const leftPos = Math.round((totalContentWidth - img.width) / 2);
      compositeList.push({
        input: img.buffer,
        top: currentY,
        left: leftPos,
      });
      currentY += img.height + gap;
    } else {
      const topPos = currentY + Math.round((totalContentHeight - currentY - img.height) / 2);
      compositeList.push({
        input: img.buffer,
        top: topPos,
        left: currentX,
      });
      currentX += img.width + gap;
    }
  }

  if (options.redactSensitive) {
    const redactW = Math.round(totalContentWidth * 0.4);
    const redactH = 45;
    const redactX = Math.round(totalContentWidth * 0.3);
    const redactY = Math.round(totalContentHeight * 0.45);

    const redactSvg = Buffer.from(`
      <svg width="${redactW}" height="${redactH}">
        <rect width="${redactW}" height="${redactH}" fill="#0f172a" rx="6"/>
        <rect width="${redactW}" height="${redactH}" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="6,4" rx="6"/>
        <text x="${redactW / 2}" y="28" font-family="Segoe UI, sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle" font-weight="bold">DADOS CONFIDENCIAIS OCULTADOS</text>
      </svg>
    `);

    compositeList.push({
      input: redactSvg,
      top: redactY,
      left: redactX,
    });
  }

  let bgObj = { r: 15, g: 23, b: 42, alpha: 1 };
  if (options.backgroundColor === 'white') {
    bgObj = { r: 255, g: 255, b: 255, alpha: 1 };
  } else if (options.backgroundColor === 'black') {
    bgObj = { r: 0, g: 0, b: 0, alpha: 1 };
  }

  const outputBuffer = await sharp({
    create: {
      width: totalContentWidth,
      height: totalContentHeight,
      channels: 4,
      background: bgObj,
    },
  })
    .composite(compositeList)
    .png({ quality: 100, compressionLevel: 6 })
    .toBuffer();

  const finalPath = targetFilePath || path.join(os.tmpdir(), `fotoduo-preview.png`);
  await fs.promises.writeFile(finalPath, outputBuffer);

  const base64 = outputBuffer.toString('base64');
  const normalizedPath = finalPath.replace(/\\/g, '/');
  const fileUri = normalizedPath.startsWith('/') ? `file://${normalizedPath}` : `file:///${normalizedPath}`;

  return {
    filePath: finalPath,
    fileUri: fileUri,
    dataUri: `data:image/png;base64,${base64}`,
    width: totalContentWidth,
    height: totalContentHeight,
    sizeBytes: outputBuffer.length,
  };
}

if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', async () => {
    try {
      const payload = JSON.parse(input);
      const res = await stitch(payload.imagePaths, payload.options || {}, payload.targetFilePath);
      process.stdout.write(JSON.stringify(res));
      process.exit(0);
    } catch (err) {
      process.stderr.write(err.stack || err.message);
      process.exit(1);
    }
  });
}

module.exports = { stitch };
