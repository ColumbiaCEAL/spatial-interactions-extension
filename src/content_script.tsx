import { getBias, playSound } from './audioPlayer';
import { getReadout } from './textContent';

console.log('Content script loaded');

// Listens for any events sent from either popup.tsx or background.ts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	if (msg.color) {
		console.log('Receive color = ' + msg.color);
		document.body.style.backgroundColor = msg.color;
		sendResponse('Change color to ' + msg.color);
	} else {
		sendResponse('Color message is none.');
	}
});

document.addEventListener('keydown', async (e) => {
	// console.log(e); (Logs keyboard events)

	switch (e.key.toLowerCase()) {
		case 'w': // Move up
			break;
		case 'a': // Move left
			break;
		case 's': // Move right
			break;
		case 'd': // Move down
			break;
		case 'b':
			if (e.ctrlKey || e.metaKey) {
				// Test active element reading with Ctrl/Command + T.
				const focusedElement = document.activeElement as HTMLElement;
				await playSound(getBias(focusedElement), getReadout(focusedElement));
			}
			break;
	}
});
