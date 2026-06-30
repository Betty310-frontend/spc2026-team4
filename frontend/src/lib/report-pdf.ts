import type { ReportMeta } from '@/types/report'

type GenerateReportPdfOptions = {
  sections: Array<{
    element: HTMLElement | null | undefined
    label: string
  }>
  meta: ReportMeta
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })
}

function sanitizeColorValue(value: string, propertyName?: string): string {
  if (!value) return value
  if (!/(oklch|oklab|lch|lab|color-mix)\(/i.test(value)) return value

  const property = propertyName?.toLowerCase() ?? ''
  if (property.includes('background')) return '#ffffff'
  if (property.includes('border') || property.includes('outline')) return '#e5e7eb'
  if (property.includes('shadow')) return 'none'
  if (property.includes('placeholder')) return '#9ca3af'
  return '#111827'
}

function installSafeComputedStyle(windowObject: Window) {
  const originalGetComputedStyle = windowObject.getComputedStyle.bind(windowObject)

  windowObject.getComputedStyle = ((element: Element, pseudoElt?: string | null) => {
    const style = originalGetComputedStyle(element, pseudoElt)

    return new Proxy(style, {
      get(target, prop) {
        if (prop === 'getPropertyValue') {
          return (propertyName: string) =>
            sanitizeColorValue(target.getPropertyValue(propertyName), propertyName)
        }

        if (prop === 'item') {
          return target.item.bind(target)
        }

        if (prop === 'getPropertyPriority') {
          return target.getPropertyPriority.bind(target)
        }

        const value = Reflect.get(target, prop, target)
        if (typeof value === 'string') {
          return sanitizeColorValue(value, typeof prop === 'string' ? prop : undefined)
        }

        if (typeof value === 'function') {
          return value.bind(target)
        }

        return value
      },
    }) as CSSStyleDeclaration
  }) as Window['getComputedStyle']

  return () => {
    windowObject.getComputedStyle = originalGetComputedStyle
  }
}

export async function generateReportPdf({ sections, meta }: GenerateReportPdfOptions) {
  if (typeof window === 'undefined') return

  const html2canvasModule = await import('html2canvas')
  const jspdfModule = await import('jspdf')

  await (document.fonts?.ready ?? Promise.resolve())
  await nextFrame()
  await nextFrame()
  await sleep(150)

  const restoreGetComputedStyle = installSafeComputedStyle(window)

  const pdf = new jspdfModule.jsPDF('p', 'pt', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 32
  const sectionGap = 16
  const contentWidth = pageWidth - margin * 2
  const maxContentHeight = pageHeight - margin * 2

  let cursorY = margin
  const seenElements = new Set<HTMLElement>()

  try {
    for (const section of sections) {
      const element = section.element
      if (!element) continue
      if (seenElements.has(element)) continue
      seenElements.add(element)

      const rect = element.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) continue
      if (element.getClientRects().length === 0) continue

      await nextFrame()
      await sleep(250)

      const canvas = await html2canvasModule.default(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        foreignObjectRendering: true,
        onclone: (clonedDocument) => {
          clonedDocument.documentElement.style.setProperty('color-scheme', 'light')
        },
      })

      if (process.env.NODE_ENV !== 'production') {
        console.debug('[report-pdf]', section.label, {
          width: canvas.width,
          height: canvas.height,
          rectWidth: rect.width,
          rectHeight: rect.height,
        })
      }

      if (canvas.width <= 0 || canvas.height <= 0) continue

      const imgWidth = contentWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      const fitScale = imgHeight > maxContentHeight ? maxContentHeight / imgHeight : 1
      const drawWidth = imgWidth * fitScale
      const drawHeight = imgHeight * fitScale

      if (cursorY !== margin && cursorY + drawHeight > pageHeight - margin) {
        pdf.addPage()
        cursorY = margin
      }

      const imgData = canvas.toDataURL('image/png')
      pdf.addImage(imgData, 'PNG', margin, cursorY, drawWidth, drawHeight)
      cursorY += drawHeight + sectionGap

      if (cursorY > pageHeight - margin - 8) {
        pdf.addPage()
        cursorY = margin
      }
    }
  } finally {
    restoreGetComputedStyle()
  }

  const filename = `상권분석_${meta.station}_${meta.category}_${meta.generated_at}.pdf`
  pdf.save(filename)
}
