'use client'

type AnyFn = (...args: unknown[]) => void

export function rafThrottle<T extends AnyFn>(fn: T): T {
  let frame: number | null = null
  let lastArgs: Parameters<T> | null = null

  const throttled = ((...args: Parameters<T>) => {
    lastArgs = args

    if (frame != null) return

    frame = requestAnimationFrame(() => {
      frame = null

      if (!lastArgs) return
      fn(...lastArgs)
      lastArgs = null
    })
  }) as T

  return throttled
}

export function debounce<T extends AnyFn>(fn: T, wait = 400): T {
  let timer: ReturnType<typeof setTimeout> | null = null

  const debounced = ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)

    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, wait)
  }) as T

  return debounced
}
