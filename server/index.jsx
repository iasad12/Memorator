import express from 'express';
import React from 'react';
import cors from 'cors';
import { renderToBuffer } from '@react-pdf/renderer';
import { createEbookDocument, registerFonts } from './EbookDocument.jsx';

const app = express();
app.use(cors());
app.use(express.json({ limit: '500mb' }));

app.post('/api/generate-ebook', async (req, res) => {
  const startTime = Date.now();
  try {
    const data = req.body;
    console.log(`[PDF] Generating ebook "${data.ebookName}" with ${data.conversations.length} conversations...`);

    const document = createEbookDocument(data);
    const buffer = await renderToBuffer(document);

    const filename = `${(data.ebookName || 'Ebook').replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, '_')}_Ebook.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(Buffer.from(buffer));

    console.log(`[PDF] Done! ${buffer.length} bytes in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  } catch (err) {
    console.error('[PDF] Generation failed:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;

// Start server after fonts are ready
async function start() {
  console.log('[PDF Server] Downloading and registering fonts (first run may take a moment)...');
  await registerFonts();
  app.listen(PORT, () => {
    console.log(`[PDF Server] Ready on http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('[PDF Server] Failed to start:', err);
  process.exit(1);
});
