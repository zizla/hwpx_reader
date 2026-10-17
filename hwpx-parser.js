/**
 * HWPX (Hancom Office XML - KS X 6101) Parser
 * Pure client-side JavaScript. Runs entirely in browser memory.
 * Extracts text, tables, styles, images, and converts to Markdown & HTML.
 */

class HwpxParser {
  constructor() {
    this.zip = null;
    this.header = {
      charPrMap: new Map(),
      paraPrMap: new Map(),
      styleMap: new Map()
    };
    this.images = new Map(); // binaryItemId -> base64 DataURL
    this.sections = [];
    this.metadata = {
      title: '',
      creator: '',
      date: '',
      sectionCount: 0,
      paragraphCount: 0,
      tableCount: 0,
      characterCount: 0
    };
  }

  /**
   * Main entry point: Parses an HWPX File or ArrayBuffer
   * @param {File|ArrayBuffer|Blob} fileInput
   * @param {Function} [onProgress]
   * @returns {Promise<{markdown: string, metadata: object, sections: array}>}
   */
  async parse(fileInput, onProgress = () => {}) {
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip 라이브러리가 로드되지 않았습니다.');
    }

    onProgress({ step: 'unzip', message: 'HWPX 압축 파일 해제 중...' });
    
    let buffer;
    if (fileInput instanceof ArrayBuffer) {
      buffer = fileInput;
    } else if (fileInput.arrayBuffer) {
      buffer = await fileInput.arrayBuffer();
    } else {
      throw new Error('유효한 파일 또는 ArrayBuffer 형식이 아닙니다.');
    }

    this.zip = await JSZip.loadAsync(buffer);

    onProgress({ step: 'header', message: '문서 헤더 및 서식 정보 분석 중...' });
    await this._parseHeader();
    await this._extractImages();

    onProgress({ step: 'content', message: '본문 내용 및 표 구조 분석 중...' });
    const sectionFiles = await this._findSectionFiles();
    this.metadata.sectionCount = sectionFiles.length;

    let fullMarkdown = '';
    const sectionResults = [];

    for (let i = 0; i < sectionFiles.length; i++) {
      const fileName = sectionFiles[i];
      onProgress({
        step: 'section',
        message: `본문 섹션 처리 중 (${i + 1}/${sectionFiles.length})...`
      });

      const xmlText = await this.zip.file(fileName).async('string');
      const sectionMd = this._parseSectionXml(xmlText);
      sectionResults.push({ file: fileName, markdown: sectionMd });
      
      if (fullMarkdown && sectionMd.trim()) {
        fullMarkdown += '\n\n---\n\n';
      }
      fullMarkdown += sectionMd;
    }

    // Clean up markdown
    fullMarkdown = this._cleanupMarkdown(fullMarkdown);

    // Update metadata stats
    this.metadata.characterCount = fullMarkdown.replace(/\s/g, '').length;
    this.metadata.paragraphCount = fullMarkdown.split(/\n\s*\n/).filter(p => p.trim()).length;

    onProgress({ step: 'complete', message: '변환 완료!' });

    return {
      markdown: fullMarkdown,
      metadata: this.metadata,
      sections: sectionResults,
      images: this.images
    };
  }

  /**
   * Parse Contents/header.xml for fonts, styles, and character formatting
   */
  async _parseHeader() {
    const headerFile = this.zip.file(/^Contents\/header\.xml$/i)[0] || 
                       this.zip.file(/header\.xml$/i)[0];
    if (!headerFile) return;

    try {
      const xmlStr = await headerFile.async('string');
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');

      // 1. Character properties (hh:charPr)
      const charPrNodes = this._findByLocalName(doc, 'charPr');
      charPrNodes.forEach(node => {
        const id = node.getAttribute('id');
        if (!id) return;

        const height = parseInt(node.getAttribute('height') || '1000', 10); // 100pt units (1000 = 10pt)
        const textColor = node.getAttribute('textColor') || '#000000';
        
        const isBold = this._findByLocalName(node, 'bold').length > 0;
        const isItalic = this._findByLocalName(node, 'italic').length > 0;
        const isUnderline = this._findByLocalName(node, 'underline').length > 0;
        const isStrike = this._findByLocalName(node, 'strikeOut').length > 0;

        this.header.charPrMap.set(id, {
          heightPt: height / 100,
          bold: isBold,
          italic: isItalic,
          underline: isUnderline,
          strike: isStrike,
          textColor
        });
      });

      // 2. Paragraph properties (hh:paraPr)
      const paraPrNodes = this._findByLocalName(doc, 'paraPr');
      paraPrNodes.forEach(node => {
        const id = node.getAttribute('id');
        if (!id) return;

        const headingNode = this._findByLocalName(node, 'heading')[0];
        let headingLevel = 0;
        let headingType = 'none';

        if (headingNode) {
          headingType = headingNode.getAttribute('type') || 'none';
          headingLevel = parseInt(headingNode.getAttribute('level') || '0', 10);
        }

        const alignNode = this._findByLocalName(node, 'align')[0];
        const align = alignNode ? alignNode.getAttribute('horizontal') || 'left' : 'left';

        this.header.paraPrMap.set(id, {
          headingType,
          headingLevel,
          align
        });
      });

      // 3. Styles (hh:style)
      const styleNodes = this._findByLocalName(doc, 'style');
      styleNodes.forEach(node => {
        const id = node.getAttribute('id');
        const name = node.getAttribute('name') || '';
        const paraPrIDRef = node.getAttribute('paraPrIDRef');
        const charPrIDRef = node.getAttribute('charPrIDRef');

        this.header.styleMap.set(id, {
          name,
          paraPrIDRef,
          charPrIDRef
        });
      });
    } catch (e) {
      console.warn('header.xml 파싱 중 경고 발생:', e);
    }
  }

  /**
   * Extract embedded images from BinData/
   */
  async _extractImages() {
    const binFiles = this.zip.file(/^BinData\/.+/i);
    for (const file of binFiles) {
      try {
        const ext = file.name.split('.').pop().toLowerCase();
        let mime = 'image/png';
        if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
        else if (ext === 'gif') mime = 'image/gif';
        else if (ext === 'svg') mime = 'image/svg+xml';
        else if (ext === 'bmp') mime = 'image/bmp';

        const base64 = await file.async('base64');
        const dataUrl = `data:${mime};base64,${base64}`;

        const baseName = file.name.split('/').pop();
        const rawId = baseName.replace(/\.[^/.]+$/, '');

        this.images.set(rawId, dataUrl);
        this.images.set(baseName, dataUrl);
        this.images.set(file.name, dataUrl);
      } catch (e) {
        console.warn(`이미지 추출 실패 (${file.name}):`, e);
      }
    }
  }

  /**
   * Determine section files in correct order
   */
  async _findSectionFiles() {
    // 1. Try to read Contents/content.hpf
    const hpfFile = this.zip.file(/^Contents\/content\.hpf$/i)[0] || 
                    this.zip.file(/content\.hpf$/i)[0];
    if (hpfFile) {
      try {
        const hpfXml = await hpfFile.async('string');
        const parser = new DOMParser();
        const doc = parser.parseFromString(hpfXml, 'text/xml');

        const manifestMap = new Map();
        const itemNodes = this._findByLocalName(doc, 'item');
        itemNodes.forEach(item => {
          const id = item.getAttribute('id');
          const href = item.getAttribute('href');
          if (id && href) {
            manifestMap.set(id, href);
          }
        });

        const spineNodes = this._findByLocalName(doc, 'itemref');
        const orderedSections = [];
        spineNodes.forEach(ref => {
          const idref = ref.getAttribute('idref');
          if (idref && manifestMap.has(idref)) {
            const path = manifestMap.get(idref);
            const fullPath = path.startsWith('Contents/') ? path : `Contents/${path}`;
            if (this.zip.file(fullPath)) {
              orderedSections.push(fullPath);
            }
          }
        });

        if (orderedSections.length > 0) {
          return orderedSections;
        }
      } catch (e) {
        console.warn('content.hpf 확인 중 경고:', e);
      }
    }

    // 2. Fallback: Search all section*.xml files and sort numerically
    const files = this.zip.file(/^Contents\/section\d+\.xml$/i);
    if (files.length > 0) {
      return files.map(f => f.name).sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
        return numA - numB;
      });
    }

    // 3. Fallback: Any section*.xml
    const anySection = this.zip.file(/section\d*\.xml$/i);
    return anySection.map(f => f.name);
  }

  /**
   * Parse single section XML into Markdown string
   */
  _parseSectionXml(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    const secNode = this._findByLocalName(doc, 'sec')[0] || doc.documentElement;

    const markdownBlocks = [];

    // Top-level paragraphs and tables
    const childNodes = secNode.children;
    for (let i = 0; i < childNodes.length; i++) {
      const node = childNodes[i];
      const localName = node.localName.toLowerCase();

      if (localName === 'p') {
        const block = this._parseParagraph(node);
        if (block) markdownBlocks.push(block);
      } else if (localName === 'tbl') {
        const tableMd = this._parseTable(node);
        if (tableMd) markdownBlocks.push(tableMd);
      }
    }

    return markdownBlocks.join('\n\n');
  }

  /**
   * Parse a single paragraph node (<hp:p>)
   */
  _parseParagraph(pNode) {
    // Check if this paragraph contains a table
    const tableNodes = this._findByLocalName(pNode, 'tbl');
    if (tableNodes.length > 0) {
      this.metadata.tableCount += tableNodes.length;
      return tableNodes.map(tbl => this._parseTable(tbl)).join('\n\n');
    }

    // Check heading level from style or paraPr
    const styleIDRef = pNode.getAttribute('styleIDRef');
    const paraPrIDRef = pNode.getAttribute('paraPrIDRef');
    let headingLevel = 0;

    if (styleIDRef && this.header.styleMap.has(styleIDRef)) {
      const style = this.header.styleMap.get(styleIDRef);
      const name = style.name.toLowerCase();
      if (/제목\s*1|개요\s*1|heading\s*1/i.test(name)) headingLevel = 1;
      else if (/제목\s*2|개요\s*2|heading\s*2/i.test(name)) headingLevel = 2;
      else if (/제목\s*3|개요\s*3|heading\s*3/i.test(name)) headingLevel = 3;
      else if (/제목\s*4|개요\s*4|heading\s*4/i.test(name)) headingLevel = 4;
      else if (/제목\s*5|개요\s*5|heading\s*5/i.test(name)) headingLevel = 5;
      else if (/제목|title/i.test(name)) headingLevel = 1;
    }

    if (!headingLevel && paraPrIDRef && this.header.paraPrMap.has(paraPrIDRef)) {
      const paraPr = this.header.paraPrMap.get(paraPrIDRef);
      if (paraPr.headingType === 'outline' && paraPr.headingLevel > 0) {
        headingLevel = Math.min(paraPr.headingLevel, 6);
      }
    }

    // Process runs (<hp:run>) inside paragraph
    const runs = this._findByLocalName(pNode, 'run');
    let paragraphText = '';
    let hasText = false;
    let maxRunHeight = 0;
    let isAllBold = runs.length > 0;

    for (const run of runs) {
      const charPrIDRef = run.getAttribute('charPrIDRef');
      const charPr = charPrIDRef ? this.header.charPrMap.get(charPrIDRef) : null;

      if (charPr) {
        if (charPr.heightPt > maxRunHeight) maxRunHeight = charPr.heightPt;
        if (!charPr.bold) isAllBold = false;
      } else {
        isAllBold = false;
      }

      // Check for image inside run
      const picNodes = this._findByLocalName(run, 'pic');
      for (const pic of picNodes) {
        const imgNodes = this._findByLocalName(pic, 'img');
        if (imgNodes.length > 0) {
          const itemRef = imgNodes[0].getAttribute('binaryItemIDRef');
          if (itemRef && this.images.has(itemRef)) {
            const imgData = this.images.get(itemRef);
            paragraphText += `\n\n![이미지](${imgData})\n\n`;
            hasText = true;
          }
        }
      }

      // Extract text nodes <hp:t>
      const textNodes = this._findByLocalName(run, 't');
      let runText = '';
      for (const t of textNodes) {
        runText += t.textContent || '';
      }

      if (runText) {
        hasText = true;
        // Apply inline styling if not already determined as a heading
        if (charPr && !headingLevel) {
          let styledText = runText;
          if (charPr.bold && styledText.trim()) {
            styledText = `**${styledText}**`;
          }
          if (charPr.italic && styledText.trim()) {
            styledText = `*${styledText}*`;
          }
          if (charPr.strike && styledText.trim()) {
            styledText = `~~${styledText}~~`;
          }
          paragraphText += styledText;
        } else {
          paragraphText += runText;
        }
      }

      // Check line breaks
      const lineBreaks = this._findByLocalName(run, 'lineBreak');
      if (lineBreaks.length > 0) {
        paragraphText += '  \n';
      }
    }

    if (!hasText && !paragraphText.trim()) {
      return '';
    }

    const trimmed = paragraphText.trim();

    // Auto-detect heading from font size if style wasn't explicitly marked
    if (!headingLevel && trimmed) {
      if (maxRunHeight >= 22) headingLevel = 1;
      else if (maxRunHeight >= 16) headingLevel = 2;
      else if (maxRunHeight >= 13 && isAllBold) headingLevel = 3;
    }

    if (headingLevel > 0) {
      // Clean duplicate bold tags inside headings
      const cleanHeading = trimmed.replace(/\*\*(.*?)\*\*/g, '$1');
      const prefix = '#'.repeat(headingLevel);
      return `${prefix} ${cleanHeading}`;
    }

    // Detect bullet or numbered lists
    if (/^[•·⁃◦▪▫■□]\s*/.test(trimmed)) {
      return `- ${trimmed.replace(/^[•·⁃◦▪▫■□]\s*/, '')}`;
    }
    if (/^(\d+)[\.\)]\s+/.test(trimmed)) {
      return trimmed;
    }
    if (/^[-*+]\s+/.test(trimmed)) {
      return trimmed;
    }

    return trimmed;
  }

  /**
   * Parse a table node (<hp:tbl>) to Markdown table
   */
  _parseTable(tblNode) {
    const trNodes = this._findByLocalName(tblNode, 'tr');
    if (trNodes.length === 0) return '';

    const rowsData = [];
    let maxCols = 0;

    for (const tr of trNodes) {
      const tcNodes = this._findByLocalName(tr, 'tc');
      const rowCells = [];

      for (const tc of tcNodes) {
        // Cells contain paragraphs
        const cellParagraphs = this._findByLocalName(tc, 'p');
        const cellLines = [];

        for (const p of cellParagraphs) {
          const runs = this._findByLocalName(p, 'run');
          let pText = '';
          for (const run of runs) {
            const textNodes = this._findByLocalName(run, 't');
            for (const t of textNodes) {
              pText += t.textContent || '';
            }
          }
          if (pText.trim()) {
            cellLines.push(pText.trim());
          }
        }

        // Clean cell text: replace pipes and newlines
        let cellText = cellLines.join(' <br> ').replace(/\|/g, '\\|');
        rowCells.push(cellText.trim() || ' ');
      }

      if (rowCells.length > maxCols) maxCols = rowCells.length;
      rowsData.push(rowCells);
    }

    if (rowsData.length === 0 || maxCols === 0) return '';

    // Pad rows so every row has maxCols
    for (const row of rowsData) {
      while (row.length < maxCols) {
        row.push(' ');
      }
    }

    const mdLines = [];

    // Header row
    const headerRow = rowsData[0];
    mdLines.push(`| ${headerRow.join(' | ')} |`);

    // Separator row
    const separator = Array(maxCols).fill('---');
    mdLines.push(`| ${separator.join(' | ')} |`);

    // Data rows
    for (let r = 1; r < rowsData.length; r++) {
      mdLines.push(`| ${rowsData[r].join(' | ')} |`);
    }

    return mdLines.join('\n');
  }

  /**
   * Post-process and tidy Markdown content
   */
  _cleanupMarkdown(md) {
    return md
      // Collapse multiple blank lines to at most 2
      .replace(/\n{3,}/g, '\n\n')
      // Merge broken inline bolding: **foo** **bar** -> **foo bar**
      .replace(/\*\*\s*\*\*/g, ' ')
      // Clean trailing spaces on lines
      .replace(/[ \t]+$/gm, '')
      .trim();
  }

  /**
   * Recursive helper: Find all elements with matching localName (case-insensitive)
   * Avoids XML namespace prefix issues (hp:p, hs:sec, hh:charPr, etc.)
   */
  _findByLocalName(element, localName) {
    const target = localName.toLowerCase();
    const results = [];

    function search(node) {
      if (!node) return;
      if (node.nodeType === 1) { // ELEMENT_NODE
        if (node.localName && node.localName.toLowerCase() === target) {
          results.push(node);
        }
      }
      const children = node.children || [];
      for (let i = 0; i < children.length; i++) {
        search(children[i]);
      }
    }

    // If doc or element, search children
    if (element.children) {
      for (let i = 0; i < element.children.length; i++) {
        search(element.children[i]);
      }
    }

    return results;
  }
}

// Attach to window for browser script usage
if (typeof window !== 'undefined') {
  window.HwpxParser = HwpxParser;
}
