import Rect from './rect';
import {
  clearPlaceholderElement,
  createPlaceholderElement,
} from './placeholder';
import { placeMark, removeMarks } from './marker';

let active: boolean = false;
let hoveringElement: HTMLElement | null = null;
let selectedElement: HTMLElement | null;
let targetElement: HTMLElement | null;
let delayedDismiss: boolean = false;
let delayedRef: ReturnType<typeof setTimeout> | null = null;
let isAltKeyDown: boolean = false;
import { Spacing as SpacingType } from './type';

const Spacing: SpacingType = {
  start() {
    if (!document.body) {
      console.warn(`Unable to initialise, document.body does not exist.`);
      return;
    }

    window.addEventListener('keydown', keyDownHandler);
    window.addEventListener('keyup', keyUpHandler);
    window.addEventListener('mousemove', cursorMovedHandler);
    window.addEventListener('mouseout', cursorLeaveHandler);
  },

  stop() {
    // Remove all event listeners
    window.removeEventListener('keydown', keyDownHandler);
    window.removeEventListener('keyup', keyUpHandler);
    window.removeEventListener('mousemove', cursorMovedHandler);
    window.removeEventListener('mouseout', cursorLeaveHandler);

    // Clean up all visual elements and reset state
    cleanUp();

    // Reset all state variables
    active = false;
    hoveringElement = null;
    selectedElement = null;
    targetElement = null;
    delayedDismiss = false;
    isAltKeyDown = false;

    // Clear any pending timeouts
    if (delayedRef) {
      clearTimeout(delayedRef);
      delayedRef = null;
    }
  },
};

function keyDownHandler(e: KeyboardEvent) {
  if (delayedDismiss) {
    cleanUp();
    if (delayedRef) {
      clearTimeout(delayedRef);
      delayedRef = null;
    }
  }

  if (e.key === 'Alt') {
    e.preventDefault();
    isAltKeyDown = true;

    if (!active && hoveringElement) {
      active = true;
      setSelectedElement();
      preventPageScroll(true);
    }
  }

  if (e.shiftKey) delayedDismiss = true;
}

function keyUpHandler(e: KeyboardEvent) {
  if (e.key === 'Alt') {
    isAltKeyDown = false;
    if (active) {
      delayedRef = setTimeout(
        () => {
          cleanUp();
        },
        delayedDismiss ? 3000 : 0
      );
    }
  }
}

function cursorLeaveHandler(e: MouseEvent) {
  let to = e.relatedTarget as HTMLElement;

  // Only clean up if we're not holding Alt key and moving to a non-content area
  if (!isAltKeyDown && (!to || to.nodeName === 'HTML')) {
    hoveringElement = null;
    cleanUp();
  }
}

function cleanUp(): void {
  active = false;
  clearPlaceholderElement('selected');
  clearPlaceholderElement('target');

  delayedDismiss = false;

  selectedElement = null;
  targetElement = null;
  removeMarks();

  preventPageScroll(false);
}

function cursorMovedHandler(e: MouseEvent) {
  if (e.composedPath) {
    // Use composedPath to detect the hovering element for supporting shadow DOM
    hoveringElement = e.composedPath()[0] as HTMLElement;
  } else {
    // Fallback if not support composedPath
    hoveringElement = e.target as HTMLElement;
  }

  // Skip if hovering over our own measurement elements
  if (
    hoveringElement &&
    (hoveringElement.classList.contains('spacing-js-marker') ||
      hoveringElement.classList.contains('spacing-js-value') ||
      hoveringElement.classList.contains('spacing-js-placeholder'))
  ) {
    return;
  }

  if (!active) return;

  setTargetElement().then(() => {
    if (selectedElement != null && targetElement != null) {
      // Do the calculation with higher precision
      let selectedElementRect: DOMRect =
        selectedElement.getBoundingClientRect();
      let targetElementRect: DOMRect = targetElement.getBoundingClientRect();

      let selected: Rect = new Rect(selectedElementRect);
      let target: Rect = new Rect(targetElementRect);

      removeMarks();

      let top: number,
        bottom: number,
        left: number,
        right: number,
        outside: boolean;

      if (
        selected.containing(target) ||
        selected.inside(target) ||
        selected.colliding(target)
      ) {
        // Elements are overlapping or nested - measure internal spacing
        top = Math.round(
          Math.abs(selectedElementRect.top - targetElementRect.top)
        );
        bottom = Math.round(
          Math.abs(selectedElementRect.bottom - targetElementRect.bottom)
        );
        left = Math.round(
          Math.abs(selectedElementRect.left - targetElementRect.left)
        );
        right = Math.round(
          Math.abs(selectedElementRect.right - targetElementRect.right)
        );
        outside = false;
      } else {
        // Elements are separate - measure external spacing
        top = Math.round(
          Math.abs(selectedElementRect.top - targetElementRect.bottom)
        );
        bottom = Math.round(
          Math.abs(selectedElementRect.bottom - targetElementRect.top)
        );
        left = Math.round(
          Math.abs(selectedElementRect.left - targetElementRect.right)
        );
        right = Math.round(
          Math.abs(selectedElementRect.right - targetElementRect.left)
        );
        outside = true;
      }

      // Only show measurements that are meaningful (> 0)
      if (top > 0) {
        placeMark(selected, target, 'top', formatDistance(top), outside);
      }
      if (bottom > 0) {
        placeMark(selected, target, 'bottom', formatDistance(bottom), outside);
      }
      if (left > 0) {
        placeMark(selected, target, 'left', formatDistance(left), outside);
      }
      if (right > 0) {
        placeMark(selected, target, 'right', formatDistance(right), outside);
      }
    }
  });
}

// Helper function to format distance measurements
function formatDistance(pixels: number): string {
  if (pixels === 0) return '0px';
  if (pixels < 1) return '<1px';
  return `${pixels}px`;
}

function setSelectedElement(): void {
  if (hoveringElement && hoveringElement !== selectedElement) {
    selectedElement = hoveringElement;
    clearPlaceholderElement('selected');

    createPlaceholderElement('selected', selectedElement, `red`);
  }
}

function setTargetElement(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (
      active &&
      hoveringElement &&
      hoveringElement !== selectedElement &&
      hoveringElement !== targetElement
    ) {
      targetElement = hoveringElement;

      clearPlaceholderElement('target');

      createPlaceholderElement('target', targetElement, 'blue');
      resolve();
    }
  });
}

function preventPageScroll(active: boolean): void {
  if (active) {
    window.addEventListener('DOMMouseScroll', scrollingPreventDefault, false);
    window.addEventListener('wheel', scrollingPreventDefault, {
      passive: false,
    });
    window.addEventListener('mousewheel', scrollingPreventDefault, {
      passive: false,
    });
  } else {
    window.removeEventListener('DOMMouseScroll', scrollingPreventDefault);
    window.removeEventListener('wheel', scrollingPreventDefault);
    window.removeEventListener('mousewheel', scrollingPreventDefault);
  }
}

function scrollingPreventDefault(e: Event): void {
  e.preventDefault();
}

export default Spacing;
