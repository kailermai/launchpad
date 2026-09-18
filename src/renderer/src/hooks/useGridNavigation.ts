import { useEffect, type RefObject } from 'react'

/**
 * Arrow-key navigation with a roving tabindex over the container's
 * `[data-nav-item]` children. Works for wrapping grids (columns are read from
 * the computed grid template) and single-row scrollers.
 */
export function useGridNavigation(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const container = ref.current
    if (!container) return

    const items = (): HTMLElement[] => Array.from(container.querySelectorAll<HTMLElement>('[data-nav-item]'))

    const setActive = (el: HTMLElement): void => {
      for (const item of items()) item.tabIndex = item === el ? 0 : -1
    }

    const columns = (): number => {
      const style = getComputedStyle(container)
      if (style.gridAutoFlow.startsWith('column')) return Number.MAX_SAFE_INTEGER
      const cols = style.gridTemplateColumns.split(' ').filter(Boolean).length
      return Math.max(1, cols)
    }

    const onKeyDown = (e: KeyboardEvent): void => {
      const list = items()
      const index = list.indexOf(document.activeElement as HTMLElement)
      if (index < 0) return
      const cols = columns()
      let next = -1
      switch (e.key) {
        case 'ArrowRight':
          next = Math.min(list.length - 1, index + 1)
          break
        case 'ArrowLeft':
          next = Math.max(0, index - 1)
          break
        case 'ArrowDown':
          next = cols === Number.MAX_SAFE_INTEGER ? -1 : Math.min(list.length - 1, index + cols)
          break
        case 'ArrowUp':
          next = cols === Number.MAX_SAFE_INTEGER ? -1 : Math.max(0, index - cols)
          break
        case 'Home':
          next = 0
          break
        case 'End':
          next = list.length - 1
          break
        default:
          return
      }
      if (next < 0 || next === index) return
      e.preventDefault()
      setActive(list[next])
      list[next].focus()
      list[next].scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }

    const onFocusIn = (e: FocusEvent): void => {
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-nav-item]')
      if (target && container.contains(target)) setActive(target)
    }

    // Initial roving state: only the first card is in the tab order.
    const first = items()
    first.forEach((el, i) => (el.tabIndex = i === 0 ? 0 : -1))
    const observer = new MutationObserver(() => {
      const list = items()
      if (list.length > 0 && !list.some((el) => el.tabIndex === 0)) list[0].tabIndex = 0
    })
    observer.observe(container, { childList: true })

    container.addEventListener('keydown', onKeyDown)
    container.addEventListener('focusin', onFocusIn)
    return () => {
      observer.disconnect()
      container.removeEventListener('keydown', onKeyDown)
      container.removeEventListener('focusin', onFocusIn)
    }
  }, [ref])
}
