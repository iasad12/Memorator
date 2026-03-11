import { jsPDF } from "jspdf";
import { getMappedName, formatDateForDisplay, formatDurationLong, formatTimeForDisplay, detectPlatform } from '../../utils/helpers';
import { computeStatsForMessages } from '../../utils/stats';

export const AVAILABLE_FONTS = [
  { value: 'helvetica', label: 'Helvetica', category: 'Sans-Serif' },
  { value: 'times', label: 'Times New Roman', category: 'Serif' },
  { value: 'courier', label: 'Courier', category: 'Monospace' },
];

function toTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function isUrdu(text) {
  if (!text) return false;
  return /[\u0600-\u06FF]/.test(text);
}

// ── Canvas-based Urdu text rendering ────────────────────────────────
// The browser's Canvas API natively handles Arabic/Urdu text shaping
// (RTL, ligatures, contextual letter forms). We render Urdu text onto
// an offscreen canvas, export as PNG, and insert into jsPDF via addImage.

let _urduFontReady = false;

async function ensureUrduFont() {
  if (_urduFontReady) return;
  
  // Use FontFace API to load the font binary directly — this guarantees
  // the font is available to canvas rendering (CSS <link> is unreliable for canvas)
  try {
    const regularFont = new FontFace(
      'Noto Nastaliq Urdu',
      "url(https://fonts.gstatic.com/s/notonastaliqurdu/v23/LhWNMUPbN-oZdNFcBy1-DJYsEoTq5pudQ9L940pGPkB3Qt_-DK0.ttf)",
      { weight: '400', style: 'normal' }
    );
    const boldFont = new FontFace(
      'Noto Nastaliq Urdu',
      "url(https://fonts.gstatic.com/s/notonastaliqurdu/v23/LhWNMUPbN-oZdNFcBy1-DJYsEoTq5pudQ9L940pGPkB3Qjj5DK0.ttf)",
      { weight: '700', style: 'normal' }
    );
    
    const [loadedRegular, loadedBold] = await Promise.all([
      regularFont.load(),
      boldFont.load()
    ]);
    
    document.fonts.add(loadedRegular);
    document.fonts.add(loadedBold);
    await document.fonts.ready;
    
    _urduFontReady = true;
    console.log("Noto Nastaliq Urdu font loaded via FontFace API (Nastaleeq style confirmed)");
  } catch (e) {
    console.warn("Could not load Noto Nastaliq Urdu font:", e);
  }
}

/**
 * Render Urdu text to an offscreen canvas and return image data.
 * Uses JPEG compression + caching for minimal file size.
 * @returns {{ dataUrl: string, widthMm: number, heightMm: number }}
 */
const _urduImageCache = new Map();

function renderUrduToImage(text, fontSizePt, bold = false) {
  // Cache key: text + size + bold
  const cacheKey = `${text}|${fontSizePt}|${bold}`;
  if (_urduImageCache.has(cacheKey)) return _urduImageCache.get(cacheKey);

  const scale = 2; // 2x DPI (good quality, 4x smaller than scale=4)
  const fontSizePx = fontSizePt * 1.333 * scale; // pt to px, scaled
  const fontWeight = bold ? '700' : '400';
  const fontFamily = "'Noto Nastaliq Urdu', 'Noto Sans Arabic', serif";

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`;

  // Measure text
  const metrics = ctx.measureText(text);
  const textW = metrics.width;
  // For Nastaliq script, ascent/descent is very large (tall curved strokes)
  const textH = fontSizePx * 2.4;

  canvas.width = Math.ceil(textW) + 8;
  canvas.height = Math.ceil(textH) + 8;

  // Re-set font after resize (canvas reset clears context state)
  ctx.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`;
  // White background for JPEG (no transparency needed)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl'; // Enable RTL for correct rendering

  // Draw text — position slightly below center to accommodate tall ascenders
  ctx.fillText(text, canvas.width - 4, canvas.height * 0.55);

  // Convert to mm (jsPDF uses mm). 1 inch = 25.4mm, 1 inch = 96px (CSS)
  const pxToMm = 25.4 / 96;
  const widthMm = (canvas.width / scale) * pxToMm;
  const heightMm = (canvas.height / scale) * pxToMm;

  const result = {
    dataUrl: canvas.toDataURL('image/jpeg', 0.6), // JPEG at 60% quality (much smaller than PNG)
    widthMm,
    heightMm,
  };

  _urduImageCache.set(cacheKey, result);
  return result;
}

// ─────────────────────────────────────────────────────────────────────

export async function generateEbookPdf(data, onProgress) {
  _urduImageCache.clear(); // Clear cache from previous generation
  try {
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    const { ebookName, aliases, conversations, fontFamily } = data;
    const font = fontFamily || 'times';
    
    // Page dimensions
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const headerHeight = 12; // Space reserved for running header
    const contentTop = margin + headerHeight; // Content starts below header
    const textWidth = pageWidth - margin * 2;
    
    // Track current conversation context for page headers
    let _currentConvName = '';
    let _currentDateStr = '';
    let _inMessages = false; // Only show header on message pages
    
    // Per-page date tracking for date range headers
    let _pageFirstDate = '';
    let _pageLastDate = '';
    
    // Draw page header: chat name on left, date range on right
    const drawPageHeader = () => {
      if (!_inMessages || !_currentConvName) return;
      doc.setFont(font, 'italic');
      doc.setFontSize(9);
      doc.setTextColor(140, 140, 140);
      // Chat name on left
      const headerName = _currentConvName.length > 40 
        ? _currentConvName.substring(0, 37) + '...' 
        : _currentConvName;
      if (isUrdu(headerName) && _urduFontReady) {
        smartText(headerName, margin, margin + 4, { fontSize: 9 });
      } else {
        doc.text(headerName, margin, margin + 4);
      }
      // Date range on right (filled retroactively by updatePageHeaderDate)
      // We'll draw a placeholder that gets overwritten
      // Separator line
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, margin + 8, pageWidth - margin, margin + 8);
      doc.setTextColor(0, 0, 0);
      doc.setDrawColor(0, 0, 0);
    };
    
    // Track page numbers and their date ranges for retroactive header update
    const pageDataMap = new Map(); // pageNum -> { firstDate, lastDate }
    
    const recordDateOnPage = (dateStr) => {
      const pageNum = doc.internal.getNumberOfPages();
      if (!pageDataMap.has(pageNum)) {
        pageDataMap.set(pageNum, { firstDate: dateStr, lastDate: dateStr });
      } else {
        pageDataMap.get(pageNum).lastDate = dateStr;
      }
    };
    
    // Helper to add pages
    let y = margin;
    const addPage = () => {
      doc.addPage();
      if (_inMessages) {
        drawPageHeader();
        y = contentTop;
        // Carry current date to the new page
        if (_currentDateStr) recordDateOnPage(_currentDateStr);
      } else {
        y = margin;
      }
    };
    
    const checkY = (needed) => {
      if (y + needed > pageHeight - margin) {
        addPage();
      }
    };

    // ── Load Urdu font for canvas ──
    onProgress(2, 'Loading Noto Nastaliq Urdu font...');
    await ensureUrduFont();
    await new Promise(r => setTimeout(r, 50));

    /**
     * Smart text renderer: uses canvas-image for Urdu, native doc.text for English.
     * @param {string} text 
     * @param {number} x - x position in mm
     * @param {number} yPos - y position in mm
     * @param {object} options - { align, fontStyle, fontSize, color }
     */
    const smartText = (text, x, yPos, options = {}) => {
      if (!text || !text.trim()) return;
      
      if (isUrdu(text) && _urduFontReady) {
        const currentFontSize = options.fontSize || doc.getFontSize();
        const bold = options.fontStyle === 'bold';
        const img = renderUrduToImage(text, currentFontSize, bold);
        
        // Handle alignment
        let imgX = x;
        if (options.align === 'center') {
          imgX = x - img.widthMm / 2;
        } else if (options.align === 'right') {
          imgX = x - img.widthMm;
        }
        
        // Adjust y — push image UP so Nastaliq descenders don't overlap next line
        const yOffset = img.heightMm * 0.45;
        doc.addImage(img.dataUrl, 'PNG', imgX, yPos - yOffset, img.widthMm, img.heightMm);
      } else {
        doc.text(text, x, yPos, options);
      }
    };

    onProgress(5, 'Building Cover and Table of Contents...');
    await new Promise(r => setTimeout(r, 50));

    // === 1. Cover Page ===
    const ebookTitle = ebookName || 'My Chat Archive';
    doc.setFontSize(28);
    doc.setFont(font, "bold");
    const splitTitle = doc.splitTextToSize(ebookTitle, pageWidth - 40);
    let titleY = pageHeight / 3;
    for (let i = 0; i < splitTitle.length; i++) {
      smartText(splitTitle[i], pageWidth / 2, titleY, { align: 'center', fontStyle: 'bold', fontSize: 28 });
      titleY += 14; // Line height for size 28
    }
    
    titleY += 10; // Extra spacing before compiled text
    const compiledText = `Compiled for: ${aliases}`;
    doc.setFontSize(16);
    doc.setFont(font, "normal");
    const splitCompiled = doc.splitTextToSize(compiledText, pageWidth - 40);
    for (let i = 0; i < splitCompiled.length; i++) {
      smartText(splitCompiled[i], pageWidth / 2, titleY, { align: 'center', fontSize: 16 });
      titleY += 8;
    }
    
    doc.setFont(font, "normal");
    doc.setFontSize(12);
    doc.text(`${conversations.length} Conversations Included`, pageWidth / 2, pageHeight / 1.5, { align: 'center' });
    
    // === 2. Table of Contents ===
    addPage();
    doc.setFont(font, "bold");
    doc.setFontSize(22);
    doc.text("Table of Contents", margin, margin + 10);
    
    // Track TOC entry positions for clickable links (added after page numbers are known)
    const tocEntries = []; // { convIndex, tocPage, tocY }
    
    y = margin + 25;
    for (let i = 0; i < conversations.length; i++) {
       const conv = conversations[i];
       checkY(10);
       const tocPage = doc.internal.getNumberOfPages();
       const tocY = y;
       tocEntries.push({ convIndex: i, tocPage, tocY });
       
       doc.setFontSize(12);
       doc.setFont(font, "normal");
       doc.setTextColor(30, 80, 160); // Blue link color
       smartText(`${i + 1}. ${conv.name}`, margin, y, { fontSize: 12 });
       doc.setTextColor(0, 0, 0);
       
       doc.setFont(font, "normal");
       doc.text(`${conv.total} msgs`, pageWidth - margin, y, { align: 'right' });
       y += 8;
    }
    
    // Track which page each conversation title starts on
    const convTitlePages = []; // page number for each conversation
    
    // === 3. Conversations ===
    const totalConvs = conversations.length;
    for (let c = 0; c < totalConvs; c++) {
      const conv = conversations[c];
      
      onProgress(10 + Math.floor((c / totalConvs) * 85), `Processing Chat ${c + 1}/${totalConvs}: ${conv.name} (${conv.total} msgs)`);
      await new Promise(r => setTimeout(r, 0)); // UI breathe
      
      // Title Page (no header on title pages)
      _inMessages = false;
      addPage();
      convTitlePages.push(doc.internal.getNumberOfPages()); // Record title page number
      doc.setFontSize(24);
      doc.setFont(font, "bold");
      smartText(conv.name, pageWidth / 2, pageHeight / 3, { align: 'center', fontStyle: 'bold', fontSize: 24 });
      
      doc.setFont(font, "normal");
      doc.setFontSize(14);
      let statsY = pageHeight / 2 - 20;
      doc.text(`Total Messages: ${conv.total}`, pageWidth / 2, statsY, { align: 'center' });
      statsY += 10;
      doc.text(`Sent: ${conv.sent}  |  Received: ${conv.received}`, pageWidth / 2, statsY, { align: 'center' });
      statsY += 10;
      if (conv.aliases && conv.aliases.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(50, 50, 50);
        const aliasText = `Aliases: ${conv.aliases.map(a => toTitleCase(a)).join(', ')}`;
        doc.setFont(font, "normal");
        smartText(aliasText, pageWidth / 2, statsY, { align: 'center', fontSize: 14 });
        doc.setTextColor(0, 0, 0);
        statsY += 10;
      }
      doc.setFont(font, "normal");
      doc.setFontSize(14);
      doc.text(`Date Range: ${formatDateForDisplay(conv.firstMsg)} - ${formatDateForDisplay(conv.lastMsg)}`, pageWidth / 2, statsY, { align: 'center' });
      statsY += 10;
      doc.text(`Duration: ${formatDurationLong(conv.lastMsg - conv.firstMsg)}`, pageWidth / 2, statsY, { align: 'center' });
      statsY += 10;
      
      const statsObj = computeStatsForMessages(conv.messages, data.aliasMap);
      if (statsObj && statsObj.maxStreak) {
        doc.text(`Longest Streak: ${statsObj.maxStreak} Day${statsObj.maxStreak === 1 ? '' : 's'}`, pageWidth / 2, statsY, { align: 'center' });
        statsY += 10;
      }

      doc.text(`Platform(s): ${conv.platforms.join(', ')}`, pageWidth / 2, statsY, { align: 'center' });
      statsY += 15;

      // Filter out phone numbers from participants list
      let displayParticipants = [];
      if (conv.participants) {
         const phoneRegex = /^[\d\s\+\-\(\)]+$/;
         displayParticipants = conv.participants.filter(p => !phoneRegex.test(p));
      }

      if (conv.isGroup && displayParticipants.length > 0) {
        doc.setFontSize(12);
        doc.setFont(font, "bold");
        doc.setTextColor(50, 50, 50);
        doc.text("Group Participants (up to 15):", pageWidth / 2, statsY, { align: 'center' });
        doc.setFont(font, "normal");
        statsY += 8;
        
        // Take up to 15 participants and join them
        const displayParts = displayParticipants.slice(0, 15);
        
        // Flow the names nicely into lines
        const partText = displayParts.join(', ') + (displayParticipants.length > 15 ? '...' : '');
        doc.setFontSize(11);
        const splitText = doc.splitTextToSize(partText, textWidth - 40);
        
        // SmartText handles Urdu correctly if they are Arabic names
        for (let i = 0; i < splitText.length; i++) {
          smartText(splitText[i], pageWidth / 2, statsY, { align: 'center', fontSize: 11 });
          statsY += 6;
        }
      }

      // Messages Section — enable headers
      _currentConvName = conv.name;
      _currentDateStr = '';
      _inMessages = true;
      addPage(); // This will now draw the header
      
      const msgs = conv.messages || [];
      const totalMsgs = msgs.length;
      let currentDateStr = '';
      
      for (let m = 0; m < totalMsgs; m++) {
         const msgObj = msgs[m];
         const msg = msgObj.msg || msgObj; // Safe access
         if (!msg || (msg.timestamp == null || (msg.timestamp === 0 && msg.dateStr === ''))) continue;
         
         // Date Separator
         const msgDateStr = formatDateForDisplay(msg.timestamp);
         if (msgDateStr !== currentDateStr) {
           currentDateStr = msgDateStr;
           _currentDateStr = msgDateStr; // Update for page headers
           recordDateOnPage(msgDateStr); // Track date on this page
           checkY(20);
           y += 5;
           doc.setFontSize(10);
           doc.setFont(font, "bold");
           doc.setTextColor(50, 50, 50);
           doc.text(msgDateStr, pageWidth / 2, y, { align: 'center' });
           doc.setTextColor(0, 0, 0);
           y += 8;
         }
         
         const sender = getMappedName(msg.sender, data.aliasMap);
         const plat = detectPlatform(msg) || msg.platform || msg._source || 'Unknown';
         const timeStr = `${formatTimeForDisplay(msg.timestamp)} @ ${plat}`;
         
         let msgText = String(msg.content || '[Media omitted]');
         
         // Strip emojis and special symbols that jsPDF fonts can't render
         msgText = msgText.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // Surrogate pair emojis
                          .replace(/[\u2600-\u27BF]/g, '')    // Misc symbols & dingbats
                          .replace(/[\uFE00-\uFE0F]/g, '')    // Variation selectors
                          .replace(/[\u200D]/g, '')            // Zero-width joiner
                          .replace(/[\u20E3]/g, '')            // Combining enclosing keycap
                          .replace(/[\u2300-\u23FF]/g, '')     // Misc technical symbols
                          .replace(/[\u2B50-\u2B55]/g, '')     // Stars, circles
                          .replace(/[\u3030\u303D]/g, '')      // CJK symbols
                          .replace(/[\uFE00-\uFEFF]/g, '')    // Special block
                          .replace(/\*\*(.*?)\*\*/g, '$1')
                          .replace(/\*(.*?)\*/g, '$1')
                          .replace(/~~(.*?)~~/g, '$1');
         
         doc.setFontSize(11);
         const senderText = `${sender}: `;
         doc.setFont(font, "bold");
         const senderW = doc.getTextWidth(senderText);
         
         // Word wrap algorithm to account for the inline sender name!
         const lines = [];
         let paragraphs = msgText.split('\n');
         
         doc.setFont(font, "normal");
         
         for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
            let p = paragraphs[pIdx];
            if (p === '' && pIdx > 0) {
               lines.push(' ');
               continue;
            }
            if (!p) continue;

            // Defensive split of long contiguous words/lines to prevent jsPDF recursion
            let words = p.split(' ');
            let curLine = '';
            let curW = (pIdx === 0 && lines.length === 0) ? senderW : 0;
            
            for (let wIdx = 0; wIdx < words.length; wIdx++) {
               let w = words[wIdx];
               if (!w && wIdx < words.length - 1) { curLine += ' '; continue; }
               
               // For width calculation, always use the base font (Urdu images will be sized to fit)
               doc.setFont(font, "normal");
               let wWidth = doc.getTextWidth(w + ' ');
               let availableW = textWidth - (curLine === '' ? curW : 0);
               
               if (wWidth > availableW) {
                  // If word is massive, chunk it first to avoid O(N^2) in char loop
                  let wParts = [];
                  let tempW = w;
                  while (tempW.length > 500) {
                     wParts.push(tempW.substring(0, 500));
                     tempW = tempW.substring(500);
                  }
                  wParts.push(tempW);

                  for (let part of wParts) {
                     let sub = '';
                     for (let char of part) {
                        if ((curLine === '' ? curW : 0) + doc.getTextWidth(curLine + sub + char) > textWidth) {
                           if (curLine || sub) lines.push(curLine + sub);
                           curLine = '';
                           curW = 0;
                           sub = char;
                        } else {
                           sub += char;
                        }
                     }
                     curLine += sub;
                  }
                  curLine += ' ';
                  curW = doc.getTextWidth(curLine);
               } else {
                  if (curW + wWidth > textWidth && curLine !== '') {
                     lines.push(curLine.trimEnd());
                     curLine = w + ' ';
                     curW = doc.getTextWidth(curLine);
                  } else {
                     curLine += w + ' ';
                     curW += wWidth;
                  }
               }
            }
            if (curLine.trimEnd()) lines.push(curLine.trimEnd());
         }

         if (lines.length === 0) lines.push('[Empty Message]');

         checkY(10);
         
         // Draw Sender Name (Bold)
         doc.setFont(font, "bold");
         doc.setFontSize(11);
         smartText(senderText, margin, y, { fontStyle: 'bold', fontSize: 11 });
         
         // Draw Message Lines (Normal)
         doc.setFont(font, "normal");
         smartText(lines[0] || '', margin + senderW, y, { fontSize: 11 });
         
         for (let l = 1; l < lines.length; l++) {
            // Use larger spacing for Urdu lines to prevent image overlap
            const lineSpacing = isUrdu(lines[l]) ? 9 : 5.5;
            y += lineSpacing;
            checkY(6);
            doc.setFont(font, "normal");
            smartText(lines[l] || '', margin, y, { fontSize: 11 });
         }
         
         // Reset for timestamp
         doc.setFont(font, "normal");
         
         // Calculate Timestamp position dynamically based on last line width
         doc.setFontSize(8);
         const timeW = doc.getTextWidth("  " + timeStr);
         
         let lastLineStr = lines[lines.length - 1] || '';
         doc.setFontSize(11);
         let lastLineW = doc.getTextWidth(lastLineStr);
         if (lines.length === 1) lastLineW += senderW;
         
         doc.setFontSize(8);
         doc.setTextColor(110, 110, 110);
         if (lastLineW + timeW < textWidth - 2) {
            doc.text(timeStr, pageWidth - margin, y, { align: 'right' });
         } else {
            y += 4;
            checkY(6);
            doc.text(timeStr, pageWidth - margin, y, { align: 'right' });
         }
         doc.setTextColor(0, 0, 0);
         y += 8; 

         
         // Occasional yield for huge chats to not freeze browser entirely
         if (m % 500 === 0) {
            await new Promise(r => setTimeout(r, 0)); 
         }
      }
    }
    
    onProgress(95, 'Adding page numbers, links & bookmarks...');
    await new Promise(r => setTimeout(r, 50));

    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 2; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont(font, "normal");
      doc.setFontSize(10);
      doc.setTextColor(128, 128, 128);
      doc.text(`${p}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      
      // Render date range in header (retroactive — now we know all dates per page)
      const pageData = pageDataMap.get(p);
      if (pageData) {
        doc.setFont(font, 'italic');
        doc.setFontSize(9);
        doc.setTextColor(140, 140, 140);
        const dateLabel = pageData.firstDate === pageData.lastDate
          ? pageData.firstDate
          : `${pageData.firstDate} - ${pageData.lastDate}`;
        doc.text(dateLabel, pageWidth - margin, margin + 4, { align: 'right' });
        doc.setTextColor(0, 0, 0);
      }
    }
    
    // Add clickable links on TOC entries pointing to conversation title pages
    for (const entry of tocEntries) {
      if (convTitlePages[entry.convIndex] != null) {
        doc.setPage(entry.tocPage);
        // Create a clickable link area over the TOC entry text
        doc.link(margin, entry.tocY - 5, textWidth, 8, { pageNumber: convTitlePages[entry.convIndex] });
      }
    }
    
    // Add PDF outline bookmarks (sidebar navigation)
    try {
      for (let i = 0; i < conversations.length; i++) {
        if (convTitlePages[i] != null) {
          doc.outline.add(null, conversations[i].name, { pageNumber: convTitlePages[i] });
        }
      }
    } catch (e) {
      console.warn('Could not add PDF bookmarks:', e);
    }
    
    onProgress(98, 'Saving document...');
    await new Promise(r => setTimeout(r, 50));
    
    const filename = `${(data.ebookName || 'Ebook').replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);

    onProgress(100, 'Download started!');
  } catch (err) {
    console.error('PDF generation error:', err);
    throw err;
  }
}
