/**
 * HWPX Studio - Application Controller
 * Handles UI interactions, Drag & Drop, Markdown/PDF exports, and theme toggling.
 * 100% Client-side. No data ever leaves the browser.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const btnSelectFile = document.getElementById('btnSelectFile');
  const btnLoadSample = document.getElementById('btnLoadSample');
  const btnDownloadSample = document.getElementById('btnDownloadSample');
  const btnThemeToggle = document.getElementById('btnThemeToggle');

  const uploadHero = document.getElementById('uploadHero');
  const progressCard = document.getElementById('progressCard');
  const progressMsg = document.getElementById('progressMsg');

  const workspaceSection = document.getElementById('workspaceSection');
  const fileNameDisplay = document.getElementById('fileNameDisplay');
  const fileStatsDisplay = document.getElementById('fileStatsDisplay');

  const btnExportMd = document.getElementById('btnExportMd');
  const btnCopyMd = document.getElementById('btnCopyMd');
  const btnPrintPdf = document.getElementById('btnPrintPdf');
  const btnDownloadPdf = document.getElementById('btnDownloadPdf');
  const btnReset = document.getElementById('btnReset');

  const tabDocView = document.getElementById('tabDocView');
  const tabMdView = document.getElementById('tabMdView');
  const docViewContainer = document.getElementById('docViewContainer');
  const mdViewContainer = document.getElementById('mdViewContainer');

  const documentPage = document.getElementById('documentPage');
  const markdownTextarea = document.getElementById('markdownTextarea');
  const wordCountDisplay = document.getElementById('wordCountDisplay');
  const toastContainer = document.getElementById('toastContainer');

  // Application State
  const state = {
    currentFile: null,
    baseFileName: 'document',
    markdown: '',
    metadata: null,
    parser: new HwpxParser(),
    isGeneratingPdf: false
  };

  // Configure Marked if available
  if (typeof marked !== 'undefined') {
    marked.setOptions({
      gfm: true,
      breaks: true,
      headerIds: true,
      mangle: false
    });
  }

  // -------------------------------------------------------------------------
  // Theme Toggle (Dark / Light)
  // -------------------------------------------------------------------------
  const savedTheme = localStorage.getItem('hwpx_theme') || 'dark';
  applyTheme(savedTheme);

  btnThemeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  });

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('hwpx_theme', theme);
    btnThemeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    btnThemeToggle.title = theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환';
  }

  // -------------------------------------------------------------------------
  // Drag & Drop Handling
  // -------------------------------------------------------------------------
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files.length > 0) {
      handleFileSelected(files[0]);
    }
  });

  dropZone.addEventListener('click', (e) => {
    if (e.target === btnLoadSample || e.target === btnDownloadSample || e.target.closest('.btn-sample')) {
      return;
    }
    fileInput.click();
  });

  btnSelectFile.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (fileInput.files && fileInput.files.length > 0) {
      handleFileSelected(fileInput.files[0]);
    }
  });

  // -------------------------------------------------------------------------
  // Sample HWPX Demo Buttons
  // -------------------------------------------------------------------------
  btnLoadSample.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      showProgress(true, '체험용 샘플 HWPX 문서를 메모리에 생성하는 중...');
      const sampleBlob = await generateSampleHwpxBlob();
      sampleBlob.name = '2026_지능형문서시스템_추진계획서.hwpx';
      await processHwpxFile(sampleBlob, sampleBlob.name);
      showToast('샘플 HWPX 문서가 성공적으로 변환되었습니다!', 'success');
    } catch (err) {
      console.error(err);
      showProgress(false);
      showToast(`샘플 로드 오류: ${err.message}`, 'error');
    }
  });

  btnDownloadSample.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      const sampleBlob = await generateSampleHwpxBlob();
      const url = URL.createObjectURL(sampleBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'DocuHWPX_샘플문서.hwpx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('샘플 .hwpx 파일이 다운로드 폴더에 저장되었습니다.', 'info');
    } catch (err) {
      showToast(`다운로드 오류: ${err.message}`, 'error');
    }
  });

  // -------------------------------------------------------------------------
  // File Validation and Processing
  // -------------------------------------------------------------------------
  async function handleFileSelected(file) {
    const ext = file.name.split('.').pop().toLowerCase();

    // Check for older binary .hwp
    if (ext === 'hwp') {
      showToast('안내: 업로드하신 파일은 구형 바이너리 .hwp 입니다. 한컴오피스에서 "다른 이름으로 저장 > HWPX"로 저장 후 업로드해주세요.', 'error', 6000);
      return;
    }

    if (ext !== 'hwpx' && ext !== 'zip') {
      const proceed = confirm(`확장자가 .${ext}인 파일입니다. HWPX(ZIP XML 패키지) 형식으로 처리를 시도할까요?`);
      if (!proceed) return;
    }

    await processHwpxFile(file, file.name);
  }

  async function processHwpxFile(fileOrBlob, filename) {
    try {
      showProgress(true, 'HWPX 파일 분석 시작...');
      state.currentFile = fileOrBlob;
      state.baseFileName = filename.replace(/\.[^/.]+$/, '');

      const result = await state.parser.parse(fileOrBlob, (progress) => {
        progressMsg.textContent = progress.message;
      });

      state.markdown = result.markdown;
      state.metadata = result.metadata;

      // Render into UI
      renderResults();
      showProgress(false);
      showToast('문서 변환이 완료되었습니다.', 'success');
    } catch (err) {
      console.error('HWPX 파싱 실패:', err);
      showProgress(false);
      showToast(`변환 실패: ${err.message}. 유효한 HWPX 파일인지 확인해주세요.`, 'error', 6000);
    }
  }

  function showProgress(show, message = '처리 중...') {
    if (show) {
      uploadHero.style.display = 'none';
      progressCard.style.display = 'block';
      workspaceSection.classList.remove('active');
      progressMsg.textContent = message;
    } else {
      progressCard.style.display = 'none';
    }
  }

  // -------------------------------------------------------------------------
  // Render Results to Paper Preview & Markdown Textarea
  // -------------------------------------------------------------------------
  function renderResults() {
    fileNameDisplay.textContent = `${state.baseFileName}.hwpx`;

    // Statistics Pills
    const meta = state.metadata || {};
    const charCount = meta.characterCount || state.markdown.length;
    const tableCount = meta.tableCount || 0;
    const paraCount = meta.paragraphCount || 0;

    fileStatsDisplay.innerHTML = `
      <span class="stat-pill">문단 ${paraCount}개</span>
      <span class="stat-pill">표 ${tableCount}개</span>
      <span class="stat-pill">공백제외 ${charCount.toLocaleString()}자</span>
    `;

    // 1. Render Markdown source
    markdownTextarea.value = state.markdown;
    wordCountDisplay.textContent = `글자 수: ${state.markdown.length.toLocaleString()} | 줄 수: ${state.markdown.split('\n').length.toLocaleString()}`;

    // 2. Render Document HTML (Paper Preview)
    if (typeof marked !== 'undefined') {
      documentPage.innerHTML = marked.parse(state.markdown);
    } else {
      // Simple fallback if marked is not loaded
      documentPage.textContent = state.markdown;
    }

    // Switch to Workspace View
    uploadHero.style.display = 'none';
    progressCard.style.display = 'none';
    workspaceSection.classList.add('active');

    // Default to Document Page View
    switchTab('doc');
  }

  // Sync edits in textarea back to preview & state
  markdownTextarea.addEventListener('input', () => {
    state.markdown = markdownTextarea.value;
    if (typeof marked !== 'undefined') {
      documentPage.innerHTML = marked.parse(state.markdown);
    }
    wordCountDisplay.textContent = `글자 수: ${state.markdown.length.toLocaleString()} | 줄 수: ${state.markdown.split('\n').length.toLocaleString()}`;
  });

  // -------------------------------------------------------------------------
  // Tabs Navigation (Document View vs. Markdown View)
  // -------------------------------------------------------------------------
  tabDocView.addEventListener('click', () => switchTab('doc'));
  tabMdView.addEventListener('click', () => switchTab('md'));

  function switchTab(mode) {
    if (mode === 'doc') {
      tabDocView.classList.add('active');
      tabMdView.classList.remove('active');
      docViewContainer.style.display = 'flex';
      mdViewContainer.classList.remove('active');
      mdViewContainer.style.display = 'none';
    } else {
      tabMdView.classList.add('active');
      tabDocView.classList.remove('active');
      docViewContainer.style.display = 'none';
      mdViewContainer.classList.add('active');
      mdViewContainer.style.display = 'flex';
    }
  }

  // -------------------------------------------------------------------------
  // Export Actions
  // -------------------------------------------------------------------------

  // 1. Download Markdown (.md)
  btnExportMd.addEventListener('click', () => {
    if (!state.markdown) {
      showToast('내보낼 마크다운 데이터가 없습니다.', 'error');
      return;
    }

    const blob = new Blob([state.markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.baseFileName}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`'${state.baseFileName}.md' 다운로드가 시작되었습니다.`, 'success');
  });

  // 2. Copy Markdown to Clipboard
  btnCopyMd.addEventListener('click', async () => {
    if (!state.markdown) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(state.markdown);
      } else {
        markdownTextarea.select();
        document.execCommand('copy');
      }
      showToast('마크다운이 클립보드에 복사되었습니다!', 'success');
    } catch (err) {
      showToast('클립보드 복사에 실패했습니다.', 'error');
    }
  });

  // 3. Print / Save as PDF (Vector Quality via window.print)
  btnPrintPdf.addEventListener('click', () => {
    // Switch to doc view for clean print rendering
    switchTab('doc');
    setTimeout(() => {
      window.print();
    }, 150);
  });

  // 4. Download PDF directly (using html2pdf.bundle.min.js)
  btnDownloadPdf.addEventListener('click', async () => {
    if (state.isGeneratingPdf) return;
    if (typeof html2pdf === 'undefined') {
      showToast('html2pdf 라이브러리를 불러오지 못했습니다. 상단의 [PDF 인쇄 / 저장]을 이용해 주세요.', 'error');
      return;
    }

    try {
      state.isGeneratingPdf = true;
      btnDownloadPdf.disabled = true;
      btnDownloadPdf.textContent = '⏳ PDF 생성 중...';
      showToast('PDF 파일을 생성하고 있습니다. 잠시만 기다려주세요...', 'info');

      // Target element
      const element = documentPage;

      const opt = {
        margin: [12, 12, 12, 12],
        filename: `${state.baseFileName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait'
        },
        pagebreak: {
          mode: ['avoid-all', 'css', 'legacy']
        }
      };

      await html2pdf().set(opt).from(element).save();
      showToast(`'${state.baseFileName}.pdf' 생성이 완료되었습니다.`, 'success');
    } catch (err) {
      console.error('PDF 직접 다운로드 오류:', err);
      showToast('PDF 직접 생성 중 오류가 발생했습니다. [PDF 인쇄 / 저장] 기능을 추천합니다.', 'error');
    } finally {
      state.isGeneratingPdf = false;
      btnDownloadPdf.disabled = false;
      btnDownloadPdf.innerHTML = '⚡ PDF 직접 다운로드';
    }
  });

  // 5. Reset to upload another file
  btnReset.addEventListener('click', () => {
    workspaceSection.classList.remove('active');
    uploadHero.style.display = 'block';
    progressCard.style.display = 'none';
    fileInput.value = '';
    state.currentFile = null;
    state.markdown = '';
    documentPage.innerHTML = '';
    markdownTextarea.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // -------------------------------------------------------------------------
  // Toast Notification Helper
  // -------------------------------------------------------------------------
  function showToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        if (toast.parentElement) {
          toast.parentElement.removeChild(toast);
        }
      }, 300);
    }, duration);
  }
});
