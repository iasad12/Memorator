import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.join(__dirname, 'fonts');

// Font manifest: CDN URL → local filename
const FONT_MANIFEST = [
  // Times New Roman
  { family: 'Times', url: 'https://cdn.jsdelivr.net/npm/@canvas-fonts/times-new-roman@1.0.4/Times%20New%20Roman.ttf', file: 'times-regular.ttf', fontWeight: 'normal' },
  { family: 'Times', url: 'https://cdn.jsdelivr.net/npm/@canvas-fonts/times-new-roman-bold@1.0.4/Times%20New%20Roman%20Bold.ttf', file: 'times-bold.ttf', fontWeight: 'bold' },
  { family: 'Times', url: 'https://cdn.jsdelivr.net/npm/@canvas-fonts/times-new-roman-italic@1.0.4/Times%20New%20Roman%20Italic.ttf', file: 'times-italic.ttf', fontStyle: 'italic' },
  { family: 'Times', url: 'https://cdn.jsdelivr.net/npm/@canvas-fonts/times-new-roman-bold-italic@1.0.4/Times%20New%20Roman%20Bold%20Italic.ttf', file: 'times-bolditalic.ttf', fontWeight: 'bold', fontStyle: 'italic' },
  // Georgia
  { family: 'Georgia', url: 'https://cdn.jsdelivr.net/gh/AshishCoreworksIT/fonts@main/georgia.ttf', file: 'georgia-regular.ttf', fontWeight: 'normal' },
  { family: 'Georgia', url: 'https://cdn.jsdelivr.net/gh/AshishCoreworksIT/fonts@main/georgiab.ttf', file: 'georgia-bold.ttf', fontWeight: 'bold' },
  { family: 'Georgia', url: 'https://cdn.jsdelivr.net/gh/AshishCoreworksIT/fonts@main/georgiai.ttf', file: 'georgia-italic.ttf', fontStyle: 'italic' },
  { family: 'Georgia', url: 'https://cdn.jsdelivr.net/gh/AshishCoreworksIT/fonts@main/georgiaz.ttf', file: 'georgia-bolditalic.ttf', fontWeight: 'bold', fontStyle: 'italic' },
  // Palatino
  { family: 'Palatino', url: 'https://cdn.jsdelivr.net/gh/AshishCoreworksIT/fonts@main/pala.ttf', file: 'palatino-regular.ttf', fontWeight: 'normal' },
  { family: 'Palatino', url: 'https://cdn.jsdelivr.net/gh/AshishCoreworksIT/fonts@main/palab.ttf', file: 'palatino-bold.ttf', fontWeight: 'bold' },
  // Garamond
  { family: 'Garamond', url: 'https://cdn.jsdelivr.net/gh/AshishCoreworksIT/fonts@main/GARA.TTF', file: 'garamond-regular.ttf', fontWeight: 'normal' },
  { family: 'Garamond', url: 'https://cdn.jsdelivr.net/gh/AshishCoreworksIT/fonts@main/GARABD.TTF', file: 'garamond-bold.ttf', fontWeight: 'bold' },
  { family: 'Garamond', url: 'https://cdn.jsdelivr.net/gh/AshishCoreworksIT/fonts@main/GARAIT.TTF', file: 'garamond-italic.ttf', fontStyle: 'italic' },
  // Roboto
  { family: 'Roboto', url: 'https://cdn.jsdelivr.net/fontsource/fonts/roboto@latest/latin-400-normal.ttf', file: 'roboto-regular.ttf', fontWeight: 'normal' },
  { family: 'Roboto', url: 'https://cdn.jsdelivr.net/fontsource/fonts/roboto@latest/latin-700-normal.ttf', file: 'roboto-bold.ttf', fontWeight: 'bold' },
  { family: 'Roboto', url: 'https://cdn.jsdelivr.net/fontsource/fonts/roboto@latest/latin-400-italic.ttf', file: 'roboto-italic.ttf', fontStyle: 'italic' },
  { family: 'Roboto', url: 'https://cdn.jsdelivr.net/fontsource/fonts/roboto@latest/latin-700-italic.ttf', file: 'roboto-bolditalic.ttf', fontWeight: 'bold', fontStyle: 'italic' },
  // Open Sans
  { family: 'Open Sans', url: 'https://cdn.jsdelivr.net/fontsource/fonts/open-sans@latest/latin-400-normal.ttf', file: 'opensans-regular.ttf', fontWeight: 'normal' },
  { family: 'Open Sans', url: 'https://cdn.jsdelivr.net/fontsource/fonts/open-sans@latest/latin-700-normal.ttf', file: 'opensans-bold.ttf', fontWeight: 'bold' },
  { family: 'Open Sans', url: 'https://cdn.jsdelivr.net/fontsource/fonts/open-sans@latest/latin-400-italic.ttf', file: 'opensans-italic.ttf', fontStyle: 'italic' },
  { family: 'Open Sans', url: 'https://cdn.jsdelivr.net/fontsource/fonts/open-sans@latest/latin-700-italic.ttf', file: 'opensans-bolditalic.ttf', fontWeight: 'bold', fontStyle: 'italic' },
];

// Download a font from CDN and save locally (skips if already cached)
async function downloadFont(url, localPath) {
  if (fs.existsSync(localPath)) return true;
  console.log(`[Fonts] Downloading ${path.basename(localPath)}...`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[Fonts] Warning: Could not download ${path.basename(localPath)} (HTTP ${res.status}), skipping`);
      return false;
    }
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(localPath, Buffer.from(buffer));
    return true;
  } catch (err) {
    console.warn(`[Fonts] Warning: Failed to download ${path.basename(localPath)}: ${err.message}`);
    return false;
  }
}

// Download all fonts and register them (async, runs at startup)
export async function registerFonts() {
  if (!fs.existsSync(FONTS_DIR)) fs.mkdirSync(FONTS_DIR, { recursive: true });

  // Download all fonts in parallel
  const results = await Promise.all(
    FONT_MANIFEST.map(async (entry) => {
      const ok = await downloadFont(entry.url, path.join(FONTS_DIR, entry.file));
      return { ...entry, downloaded: ok };
    })
  );

  // Group entries by family and register (only successfully downloaded fonts)
  const families = {};
  results.filter(r => r.downloaded).forEach(entry => {
    if (!families[entry.family]) families[entry.family] = [];
    const fontDef = { src: path.join(FONTS_DIR, entry.file) };
    if (entry.fontWeight) fontDef.fontWeight = entry.fontWeight;
    if (entry.fontStyle) fontDef.fontStyle = entry.fontStyle;
    families[entry.family].push(fontDef);
  });

  Object.entries(families).forEach(([family, fonts]) => {
    Font.register({ family, fonts });
  });

  console.log('[PDF Server] All fonts downloaded and registered.');
}

// === HELPERS ===
const PLATFORM_MAP = { html: 'Messenger', json: 'Messenger', txt: 'WhatsApp', ndjson: 'SMS', smsjson: 'SMS' };

function getMappedName(name, aliasMap) {
  if (!name) return 'Unknown';
  return aliasMap[name] || name;
}

function formatDateForDisplay(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTimeForDisplay(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDurationLong(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(months / 12);
  const parts = [];
  if (years > 0) parts.push(`${years} year${years !== 1 ? 's' : ''}`);
  if (months % 12 > 0) parts.push(`${months % 12} month${months % 12 !== 1 ? 's' : ''}`);
  if (days % 30 > 0 && years === 0) parts.push(`${days % 30} day${days % 30 !== 1 ? 's' : ''}`);
  return parts.length > 0 ? parts.join(', ') : 'Less than a day';
}

function getTimeAndPlatform(msg) {
  const time = formatTimeForDisplay(msg.timestamp);
  const platform = PLATFORM_MAP[msg._source] || 'Unknown';
  return time ? `${time} @ ${platform}` : `@ ${platform}`;
}

function getConversationDateRange(conv) {
  if (conv.firstMsg && conv.lastMsg) {
    const start = formatDateForDisplay(conv.firstMsg);
    const end = formatDateForDisplay(conv.lastMsg);
    if (start === end) return start;
    return `${start} – ${end}`;
  }
  return '';
}

// === MARKDOWN TEXT RENDERER ===
function renderMarkdownText(text) {
  if (!text) return null;
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<Text key={key++}>{text.slice(lastIndex, match.index)}</Text>);
    }
    if (match[2]) {
      parts.push(<Text key={key++} style={{ fontWeight: 'bold' }}>{match[2]}</Text>);
    } else if (match[3]) {
      parts.push(<Text key={key++} style={{ fontStyle: 'italic' }}>{match[3]}</Text>);
    } else if (match[4]) {
      parts.push(<Text key={key++} style={{ textDecoration: 'line-through' }}>{match[4]}</Text>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(<Text key={key++}>{text.slice(lastIndex)}</Text>);
  }
  if (parts.length === 0) return <Text>{text}</Text>;
  return parts;
}

// === DYNAMIC STYLES ===
function createStyles(fontFamily) {
  return StyleSheet.create({
    page: {
      fontFamily,
      fontSize: 11,
      paddingTop: 60,
      paddingBottom: 50,
      paddingHorizontal: 55,
      color: '#1a1a1a',
    },
    coverPage: {
      fontFamily,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      paddingHorizontal: 55,
    },
    coverTitle: {
      fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, color: '#111',
    },
    coverAliases: {
      fontSize: 14, textAlign: 'center', color: '#555', marginBottom: 40, fontStyle: 'italic',
    },
    coverStat: {
      fontSize: 13, textAlign: 'center', color: '#333', marginBottom: 6,
    },
    tocTitle: {
      fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 30, color: '#111',
    },
    tocItem: {
      flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4,
      borderBottom: '0.5 solid #ddd', marginBottom: 2,
    },
    tocName: { fontSize: 11, flex: 1, color: '#222' },
    tocNumber: { fontSize: 10, color: '#999', width: 25 },
    chatTitlePage: {
      fontFamily,
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      alignItems: 'center', height: '100%', paddingHorizontal: 55,
    },
    chatTitleName: {
      fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 10, color: '#111',
    },
    chatTitleAliases: {
      fontSize: 12, textAlign: 'center', color: '#666', marginBottom: 35, fontStyle: 'italic',
    },
    chatTitleStat: { fontSize: 12, textAlign: 'center', color: '#333', marginBottom: 8 },
    chatTitleStatLabel: { fontWeight: 'bold' },
    header: {
      position: 'absolute', top: 20, left: 55, right: 55,
      flexDirection: 'row', justifyContent: 'space-between',
      fontSize: 9, color: '#888', borderBottom: '0.5 solid #ccc', paddingBottom: 6,
    },
    footer: {
      position: 'absolute', bottom: 20, left: 55, right: 55,
      textAlign: 'center', fontSize: 9, color: '#888',
    },
    dateSeparator: {
      textAlign: 'center', fontSize: 11, fontWeight: 'bold', color: '#333',
      marginTop: 14, marginBottom: 10,
    },
    messageRow: {
      marginBottom: 5, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    },
    messageContent: { flex: 1, fontSize: 11, lineHeight: 1.5, color: '#1a1a1a' },
    senderName: { fontWeight: 'bold', fontSize: 11 },
    messageTimestamp: {
      fontSize: 8.5, color: '#888', marginLeft: 10, textAlign: 'right', minWidth: 90, flexShrink: 0,
    },
  });
}

// === PDF COMPONENTS ===

function CoverPage({ data, s }) {
  return (
    <Page size="A4" style={{ padding: 0 }}>
      <View style={s.coverPage}>
        <Text style={s.coverTitle}>{data.ebookName}</Text>
        <Text style={s.coverAliases}>{data.aliases}</Text>
        <Text style={{ ...s.coverStat, marginTop: 20, fontSize: 15, fontWeight: 'bold' }}>
          {data.conversations.length} Conversation{data.conversations.length !== 1 ? 's' : ''}
        </Text>
      </View>
    </Page>
  );
}

function TocPages({ conversations, s }) {
  const itemsPerPage = 35;
  const pages = [];
  for (let i = 0; i < conversations.length; i += itemsPerPage) {
    pages.push(conversations.slice(i, i + itemsPerPage));
  }
  return pages.map((pageItems, pageIdx) => (
    <Page key={`toc-${pageIdx}`} size="A4" style={s.page}>
      {pageIdx === 0 && <Text style={s.tocTitle}>Table of Contents</Text>}
      {pageItems.map((conv, i) => {
        const globalIdx = pageIdx * itemsPerPage + i;
        return (
          <View key={globalIdx} style={s.tocItem}>
            <Text style={s.tocNumber}>{globalIdx + 1}.</Text>
            <Text style={s.tocName}>{conv.name}</Text>
          </View>
        );
      })}
      <Text style={s.footer} fixed>Table of Contents</Text>
    </Page>
  ));
}

function ChatTitlePage({ conv, s }) {
  const durationMs = (conv.firstMsg && conv.lastMsg) ? (conv.lastMsg - conv.firstMsg) : 0;
  const durationStr = durationMs > 0 ? formatDurationLong(durationMs) : 'N/A';
  const startDate = conv.firstMsg ? formatDateForDisplay(conv.firstMsg) : 'N/A';
  const endDate = conv.lastMsg ? formatDateForDisplay(conv.lastMsg) : 'N/A';

  return (
    <Page size="A4" style={{ padding: 0 }}>
      <View style={s.chatTitlePage}>
        <Text style={s.chatTitleName}>{conv.name}</Text>
        {conv.aliases && conv.aliases.length > 0 && (
          <Text style={s.chatTitleAliases}>({conv.aliases.join(', ')})</Text>
        )}
        <View style={{ marginTop: 10 }}>
          <Text style={s.chatTitleStat}>
            <Text style={s.chatTitleStatLabel}>Incoming messages: </Text>{conv.received}
          </Text>
          <Text style={s.chatTitleStat}>
            <Text style={s.chatTitleStatLabel}>Outgoing messages: </Text>{conv.sent}
          </Text>
          <Text style={s.chatTitleStat}>
            <Text style={s.chatTitleStatLabel}>Total Messages: </Text>{conv.total}
          </Text>
          <Text style={s.chatTitleStat}>
            <Text style={s.chatTitleStatLabel}>Conversation Started on: </Text>{startDate}
          </Text>
          <Text style={s.chatTitleStat}>
            <Text style={s.chatTitleStatLabel}>Conversation Ended on: </Text>{endDate}
          </Text>
          <Text style={s.chatTitleStat}>
            <Text style={s.chatTitleStatLabel}>Duration: </Text>{durationStr}
          </Text>
          <Text style={s.chatTitleStat}>
            <Text style={s.chatTitleStatLabel}>Platforms Included: </Text>{conv.platforms.join(', ')}
          </Text>
        </View>
      </View>
    </Page>
  );
}

function ConversationPages({ conv, aliasMap, s }) {
  const msgs = conv.messages;
  if (!msgs || msgs.length === 0) return null;

  const messageGroups = [];
  let currentDate = '';
  msgs.forEach(msg => {
    const dateStr = formatDateForDisplay(msg.timestamp);
    if (dateStr !== currentDate) {
      currentDate = dateStr;
      messageGroups.push({ type: 'date', date: dateStr });
    }
    messageGroups.push({ type: 'message', msg });
  });

  const dateRange = getConversationDateRange(conv);

  return (
    <Page size="A4" style={s.page} wrap>
      {/* Header: contact name (left) + date range (right) */}
      <View style={s.header} fixed>
        <Text>{conv.name}</Text>
        <Text>{dateRange}</Text>
      </View>

      {messageGroups.map((item, i) => {
        if (item.type === 'date') {
          return <Text key={`d-${i}`} style={s.dateSeparator}>{item.date}</Text>;
        }
        const msg = item.msg;
        const mappedSender = getMappedName(msg.sender, aliasMap);
        const timeStr = getTimeAndPlatform(msg);

        return (
          <View key={`m-${i}`} style={s.messageRow} wrap={false}>
            <Text style={s.messageContent}>
              <Text style={s.senderName}>{mappedSender}: </Text>
              {renderMarkdownText(msg.content)}
            </Text>
            <Text style={s.messageTimestamp}>{timeStr}</Text>
          </View>
        );
      })}

      {/* Footer: page number centered */}
      <Text style={s.footer} fixed render={({ pageNumber }) => `${pageNumber}`} />
    </Page>
  );
}

// === MAIN DOCUMENT FACTORY ===
export function createEbookDocument(data) {
  const fontFamily = data.fontFamily || 'Times';
  const s = createStyles(fontFamily);
  const aliasMap = data.aliasMap || {};

  return (
    <Document
      title={data.ebookName}
      author={data.aliases}
      subject="Chat Archive Ebook"
      creator="Chat Data Exporter Pro v7.0"
    >
      <CoverPage data={data} s={s} />
      <TocPages conversations={data.conversations} s={s} />
      {data.conversations.map((conv, i) => (
        <React.Fragment key={i}>
          <ChatTitlePage conv={conv} s={s} />
          <ConversationPages conv={conv} aliasMap={aliasMap} s={s} />
        </React.Fragment>
      ))}
    </Document>
  );
}
