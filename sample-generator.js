/**
 * In-memory Sample HWPX Generator
 * Creates a valid KS X 6101 HWPX archive on the fly using JSZip
 * Allows instantaneous zero-friction demo testing.
 */

async function generateSampleHwpxBlob() {
  if (typeof JSZip === 'undefined') {
    throw new Error('JSZip 라이브러리가 로드되지 않았습니다.');
  }

  const zip = new JSZip();

  // 1. mimetype (KS X 6101 표준)
  zip.file('mimetype', 'application/hwp+zip');

  // 2. META-INF/container.xml
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <ocf:rootfiles>
    <ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwp+zip"/>
  </ocf:rootfiles>
</ocf:container>`);

  // 3. Contents/content.hpf
  zip.file('Contents/content.hpf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0">
  <manifest>
    <item id="header" href="header.xml" media-type="application/xml"/>
    <item id="section0" href="section0.xml" media-type="application/xml"/>
  </manifest>
  <spine>
    <itemref idref="section0"/>
  </spine>
</package>`);

  // 4. Contents/header.xml (Styles and character properties)
  zip.file('Contents/header.xml', `<?xml version="1.0" encoding="UTF-8"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head">
  <hh:charProperties>
    <hh:charPr id="0" height="1000" textColor="#333333"/>
    <hh:charPr id="1" height="2400" textColor="#0f172a"><hh:bold/></hh:charPr>
    <hh:charPr id="2" height="1600" textColor="#1e293b"><hh:bold/></hh:charPr>
    <hh:charPr id="3" height="1300" textColor="#334155"><hh:bold/></hh:charPr>
    <hh:charPr id="4" height="1000" textColor="#2563eb"><hh:bold/></hh:charPr>
    <hh:charPr id="5" height="1000" textColor="#64748b"><hh:italic/></hh:charPr>
  </hh:charProperties>
  <hh:styles>
    <hh:style id="0" type="para" name="바탕글" paraPrIDRef="0" charPrIDRef="0"/>
    <hh:style id="1" type="para" name="제목 1" paraPrIDRef="1" charPrIDRef="1"/>
    <hh:style id="2" type="para" name="제목 2" paraPrIDRef="2" charPrIDRef="2"/>
    <hh:style id="3" type="para" name="제목 3" paraPrIDRef="3" charPrIDRef="3"/>
  </hh:styles>
</hh:head>`);

  // 5. Contents/section0.xml (Realistic Korean business/tech report)
  zip.file('Contents/section0.xml', `<?xml version="1.0" encoding="UTF-8"?>
<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">
  <hp:p styleIDRef="1">
    <hp:run charPrIDRef="1"><hp:t>2026 차세대 지능형 로컬 문서 처리 시스템 추진 계획서</hp:t></hp:run>
  </hp:p>
  <hp:p styleIDRef="0">
    <hp:run charPrIDRef="5"><hp:t>작성부서: 디지털혁신추진본부 | 작성일: 2026. 10. 17 | 보안등급: 사내 대외비 (In-Memory Processing)</hp:t></hp:run>
  </hp:p>
  <hp:p styleIDRef="2">
    <hp:run charPrIDRef="2"><hp:t>1. 추진 배경 및 개요</hp:t></hp:run>
  </hp:p>
  <hp:p styleIDRef="0">
    <hp:run charPrIDRef="0"><hp:t>본 문서는 공공기관 및 주요 기업에서 널리 활용되는 한컴오피스 HWPX 표준 문서를 안전하고 신속하게 분석하고, 마크다운(Markdown) 및 고품질 PDF 포맷으로 즉시 변환하기 위한 기술 전략을 담고 있습니다.</hp:t></hp:run>
  </hp:p>
  <hp:p styleIDRef="0">
    <hp:run charPrIDRef="4"><hp:t>[핵심 보안 원칙]</hp:t></hp:run>
    <hp:run charPrIDRef="0"><hp:t> 사용자의 문서는 어떠한 경우에도 외부 서버나 제3자 클라우드로 전송되지 않으며, 사용자 웹 브라우저의 로컬 메모리(RAM) 내에서 100% 파싱 및 렌더링 처리됩니다. 인터넷 연결이 차단된 오프라인 상태에서도 완벽하게 동작합니다.</hp:t></hp:run>
  </hp:p>
  <hp:p styleIDRef="2">
    <hp:run charPrIDRef="2"><hp:t>2. 시스템 아키텍처 및 기존 방식 비교</hp:t></hp:run>
  </hp:p>
  <hp:p styleIDRef="0">
    <hp:tbl id="0">
      <hp:tr>
        <hp:tc><hp:p><hp:run charPrIDRef="4"><hp:t>구분 항목</hp:t></hp:run></hp:p></hp:tc>
        <hp:tc><hp:p><hp:run charPrIDRef="4"><hp:t>기존 서버 변환 방식</hp:t></hp:run></hp:p></hp:tc>
        <hp:tc><hp:p><hp:run charPrIDRef="4"><hp:t>DocuHWPX 로컬 변환 방식</hp:t></hp:run></hp:p></hp:tc>
        <hp:tc><hp:p><hp:run charPrIDRef="4"><hp:t>기대 효과</hp:t></hp:run></hp:p></hp:tc>
      </hp:tr>
      <hp:tr>
        <hp:tc><hp:p><hp:run charPrIDRef="0"><hp:t>데이터 보안</hp:t></hp:run></hp:p></hp:tc>
        <hp:tc><hp:p><hp:run charPrIDRef="0"><hp:t>외부 서버 업로드 필수 (유출 위험 존재)</hp:t></hp:run></hp:p></hp:tc>
        <hp:tc><hp:p><hp:run charPrIDRef="0"><hp:t>100% 클라이언트 메모리 처리</hp:t></hp:run></hp:p></hp:tc>
        <hp:tc><hp:p><hp:run charPrIDRef="0"><hp:t>기밀 문서 유출 위험 원천 차단</hp:t></hp:run></hp:p></hp:tc>
      </hp:tr>
      <hp:tr>
        <hp:tc><hp:p><hp:run charPrIDRef="0"><hp:t>처리 속도</hp:t></hp:run></hp:p></hp:tc>
        <hp:tc><hp:p><hp:run charPrIDRef="0"><hp:t>업/다운로드 지연 및 서버 대기 (3~10초)</hp:t></hp:run></hp:p></hp:tc>
        <hp:tc><hp:p><hp:run charPrIDRef="0"><hp:t>즉각적인 로컬 파싱 (0.2초 이내)</hp:t></hp:run></hp:p></hp:tc>
        <hp:tc><hp:p><hp:run charPrIDRef="0"><hp:t>업무 처리 생산성 500% 향상</hp:t></hp:run></hp:p></hp:tc>
      </hp:tr>
      <hp:tr>
        <hp:tc><hp:p><hp:run charPrIDRef="0"><hp:t>출력 포맷</hp:t></hp:run></hp:p></hp:tc>
        <hp:tc><hp:p><hp:run charPrIDRef="0"><hp:t>단순 평문 텍스트 추출 수준</hp:t></hp:run></hp:p></hp:tc>
        <hp:tc><hp:p><hp:run charPrIDRef="0"><hp:t>표/스타일 보존 Markdown 및 벡터 PDF</hp:t></hp:run></hp:p></hp:tc>
        <hp:tc><hp:p><hp:run charPrIDRef="0"><hp:t>표준 개발 도구 및 문서화 연동</hp:t></hp:run></hp:p></hp:tc>
      </hp:tr>
    </hp:tbl>
  </hp:p>
  <hp:p styleIDRef="2">
    <hp:run charPrIDRef="2"><hp:t>3. 세부 실행 계획 및 마일스톤</hp:t></hp:run>
  </hp:p>
  <hp:p styleIDRef="0">
    <hp:run charPrIDRef="0"><hp:t>• 1단계 (파싱 코어): KS X 6101 HWPX Open Packaging XML 스키마 정밀 분석 및 자바스크립트 엔진 구축</hp:t></hp:run>
  </hp:p>
  <hp:p styleIDRef="0">
    <hp:run charPrIDRef="0"><hp:t>• 2단계 (렌더링 최적화): Marked 기반 마크다운 뷰어 및 A4 표준 규격 양식 렌더러 통합</hp:t></hp:run>
  </hp:p>
  <hp:p styleIDRef="0">
    <hp:run charPrIDRef="0"><hp:t>• 3단계 (다중 내보내기): 원클릭 .md 다운로드, 고품질 인쇄/PDF 저장 및 직접 PDF 생성 기능 구현</hp:t></hp:run>
  </hp:p>
  <hp:p styleIDRef="2">
    <hp:run charPrIDRef="2"><hp:t>4. 종합 결론 및 기대 성과</hp:t></hp:run>
  </hp:p>
  <hp:p styleIDRef="0">
    <hp:run charPrIDRef="0"><hp:t>별도의 백엔드 서버나 파이썬 등 외부 프로그램 설치 없이 브라우저 단독으로 HWPX 문서를 완벽하게 해석하여 개방형 포맷(Markdown, PDF)으로 전환함으로써 업무 환경의 자율성과 보안성을 극대화합니다.</hp:t></hp:run>
  </hp:p>
</hs:sec>`);

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/hwp+zip'
  });
}

if (typeof window !== 'undefined') {
  window.generateSampleHwpxBlob = generateSampleHwpxBlob;
}
