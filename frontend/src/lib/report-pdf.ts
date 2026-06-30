import type { ReportMeta } from '@/types/report'

type GenerateReportPdfOptions = {
  element: HTMLElement
  meta: ReportMeta
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => { window.setTimeout(resolve, ms) })
}

function nextFrame() {
  return new Promise<void>((resolve) => { window.requestAnimationFrame(() => resolve()) })
}

export async function generateReportPdf({ element, meta }: GenerateReportPdfOptions) {
  if (typeof window === 'undefined') return

  const [{ toPng }, { jsPDF }] = await Promise.all([
    import('html-to-image'),
    import('jspdf'),
  ])

  await (document.fonts?.ready ?? Promise.resolve())
  await nextFrame()
  await nextFrame()
  await sleep(200)

  // 캡처 전에 자식 블록 경계 측정 (CSS pixel 기준, element 상단 기준 상대 좌표)
  const elementRect = element.getBoundingClientRect()
  const childRects = Array.from(element.children).map((child) => {
    const rect = child.getBoundingClientRect()
    return {
      top: rect.top - elementRect.top,
      bottom: rect.bottom - elementRect.top,
    }
  })

  // PDF 캡처 중에만 그림자 제거
  const noShadowStyle = document.createElement('style')
  noShadowStyle.textContent = '* { box-shadow: none !important; }'
  document.head.appendChild(noShadowStyle)

  let dataUrl: string
  try {
    // html-to-image: 브라우저가 CSS(oklch 포함)를 직접 렌더링 → 파싱 오류 없음
    dataUrl = await toPng(element, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      // 폰트·이미지 등 외부 리소스를 data URL로 인라인 처리
      fetchRequestInit: { cache: 'force-cache' },
    })
  } finally {
    document.head.removeChild(noShadowStyle)
  }

  // dataUrl → Image → 실제 픽셀 크기 파악
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = dataUrl
  })

  const pdf = new jsPDF('p', 'pt', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 24
  const contentWidthPt = pageWidth - margin * 2
  const contentHeightPt = pageHeight - margin * 2

  // 이미지 전체를 임시 캔버스에 그린 뒤 페이지 단위로 슬라이싱
  const fullCanvas = document.createElement('canvas')
  fullCanvas.width = img.naturalWidth
  fullCanvas.height = img.naturalHeight
  const ctx = fullCanvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, fullCanvas.width, fullCanvas.height)
  ctx.drawImage(img, 0, 0)

  const pxPerPt = fullCanvas.width / contentWidthPt
  const pageHeightPx = Math.round(contentHeightPt * pxPerPt)

  // CSS pixel → 이미지 pixel 스케일 (pixelRatio)
  const imageScale = fullCanvas.width / element.offsetWidth
  const blockRects = childRects.map(({ top, bottom }) => ({
    top: Math.round(top * imageScale),
    bottom: Math.round(bottom * imageScale),
  }))

  let sliceY = 0
  let isFirstPage = true

  while (sliceY < fullCanvas.height) {
    const remaining = fullCanvas.height - sliceY

    let sliceH: number

    if (remaining <= pageHeightPx) {
      sliceH = remaining
    } else {
      const idealBreakY = sliceY + pageHeightPx
      let cutY = idealBreakY

      // 페이지 경계에 걸치는 블록이 있으면 그 블록 직전에서 페이지 분리
      for (const { top, bottom } of blockRects) {
        if (top > sliceY && top < idealBreakY && bottom > idealBreakY) {
          cutY = top
          break
        }
      }

      sliceH = cutY - sliceY
    }

    const sliceCanvas = document.createElement('canvas')
    sliceCanvas.width = fullCanvas.width
    sliceCanvas.height = sliceH
    const sliceCtx = sliceCanvas.getContext('2d')!
    sliceCtx.fillStyle = '#ffffff'
    sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height)
    sliceCtx.drawImage(fullCanvas, 0, sliceY, fullCanvas.width, sliceH, 0, 0, fullCanvas.width, sliceH)

    if (!isFirstPage) pdf.addPage()
    isFirstPage = false

    pdf.addImage(
      sliceCanvas.toDataURL('image/png'),
      'PNG',
      margin, margin,
      contentWidthPt,
      sliceH / pxPerPt,
    )

    sliceY += sliceH
  }

  pdf.save(`상권분석_${meta.station}_${meta.category}_${meta.generated_at}.pdf`)
}
