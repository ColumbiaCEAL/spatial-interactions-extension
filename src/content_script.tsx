import Haikunator from "haikunator";
import { playSound, stopAllSounds } from "./audioPlayer";
import { initializeNavigationListeners, lastFocusedElement, setLastFocusedElement } from "./navigation";
import { getReadout } from "./textContent";
import { initializeExtensionToggleListener } from "./toggleHandler";
import { Direction } from "./types/direction";
import { EventType, PopupEventType } from "./types/events";
import { ScrollSettings, Settings } from "./types/settings";
import { getBias } from "./utils/element.utils";
import { onEventListenerStatusChange } from "./utils/eventHandling.utils";
import { Logger } from "./utils/logging.utils";
import { isExtensionEnabled } from "./utils/settings.utils";

console.log("%cSpatial Interactions Extension: Content script loaded!", "color: green; font-style: bold");

const initialize = async () => {
  // Make sure the user has an identifiable username
  let { uid } = await chrome.storage.sync.get(["uid"]);
  if (uid === undefined) {
    const haikuinator = new Haikunator();
    uid = haikuinator.haikunate();

    await chrome.storage.sync.set({ uid });
  }

  let logger: Logger | undefined;

  const { enableCloudWatch } = await chrome.storage.sync.get(["enableCloudWatch"]);
  if (enableCloudWatch) {
    logger = new Logger(uid);
  }

  initializeExtensionToggleListener();

  // Set up 'WASD' navigation
  const extensionEnabled = await isExtensionEnabled();
  if (!extensionEnabled) return;

  initializeNavigationListeners(logger);
  initializeFocusHandlers(logger);
};

// Detects which element is currently being focused on and gives it a border
let lastScrollYPos = window.scrollY;
let styledElements: HTMLElement[] = [];
let firstFocus = true;

const focusCallbacks: {
  focusIn?: (this: Document, ev: FocusEvent) => any;
  focusOut?: (this: Document, ev: FocusEvent) => any;
} = {};

const initializeFocusHandlers = (logger?: Logger) => {
  // Clear out existing handlers if they already exist
  clearFocusHandlers();

  const focusInListenerCallback = async () => {
    const { scrollFeedback, spatializeScrollFeedback, mute } = await getScrollSoundSettings();

    firstFocus = false;

    const activeElement = document.activeElement as HTMLElement;
    setLastFocusedElement(activeElement);

    styledElements.push(activeElement);

    activeElement.style.outline = "4px rgb(255, 123, 0) dashed";
    activeElement.style.outlineOffset = "-1px";

    if (window.scrollY != lastScrollYPos && !firstFocus) {
      lastScrollYPos = window.scrollY;

      logger?.logScrollEvent(activeElement.tagName, window.scrollY > lastScrollYPos ? Direction.Down : Direction.Up);

      if (scrollFeedback && !mute)
        await playSound({
          bias: spatializeScrollFeedback ? { x: getBias(lastFocusedElement!).x, y: -1 } : { x: 0, y: 0 },
          scrollBeep: true,
        });
    }

    if (!mute) playSound({ bias: getBias(activeElement), text: getReadout(activeElement) });
  };

  const focusOutListenerCallback = () => {
    styledElements.forEach((el) => {
      if (el != document.activeElement) {
        el.style.outline = "";
        el.removeAttribute("outlineOffset");
      }
    });

    styledElements.splice(0, styledElements.length);
  };

  focusCallbacks.focusIn = focusInListenerCallback;
  focusCallbacks.focusOut = focusOutListenerCallback;

  document.addEventListener("focusin", focusInListenerCallback, true);
  document.addEventListener("focusout", focusOutListenerCallback, true);
};

const clearFocusHandlers = () => {
  if (focusCallbacks.focusIn) {
    document.removeEventListener("focusin", focusCallbacks.focusIn, true);
    focusCallbacks.focusIn = undefined;
  }

  if (focusCallbacks.focusOut) {
    document.removeEventListener("focusout", focusCallbacks.focusOut, true);
    focusCallbacks.focusOut = undefined;
  }
};

async function getScrollSoundSettings(): Promise<Pick<Settings, "mute"> & ScrollSettings> {
  const items = await chrome.storage.sync.get(["scrollFeedback", "spatializeScrollFeedback", "mute"]);
  const { scrollFeedback, spatializeScrollFeedback, mute } = items as Partial<Settings>;

  return {
    scrollFeedback: scrollFeedback ?? false,
    spatializeScrollFeedback: spatializeScrollFeedback ?? false,
    mute: mute ?? false,
  };
}

let allElementsHighlighted = false;
function highlightChildren(element: HTMLElement, clear: boolean) {
  if (clear) {
    element.style.outline = "";
    element.removeAttribute("outlineOffset");
  } else {
    element.style.outline = "2px #00d0ff dashed";
    element.style.outlineOffset = "-1px";
  }

  for (let i = 0; i < element.children.length; i++) {
    const child = element.children[i] as HTMLElement;
    highlightChildren(child, clear);
  }
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type === EventType.Popup) {
    switch (message.data) {
      case PopupEventType.EnableEventListeners:
        chrome.runtime.sendMessage({ type: EventType.EventListeners, data: "enable" });
        break;
      case PopupEventType.DisableEventListeners:
        chrome.runtime.sendMessage({ type: EventType.EventListeners, data: "disable" });
        break;
      case PopupEventType.OutlineElements:
        if (!allElementsHighlighted) {
          highlightChildren(document.documentElement, false);
          allElementsHighlighted = true;
        }
        break;
      case PopupEventType.ClearOutlines:
        if (allElementsHighlighted) {
          highlightChildren(document.documentElement, true);
          allElementsHighlighted = false;
        }
        break;

      default:
        console.warn("Unknown message received:", message);
        break;
    }
  }
});

onEventListenerStatusChange({
  onEnable: initializeFocusHandlers,
  onDisable: () => {
    clearFocusHandlers();
    stopAllSounds();
  },
});

initialize();
