const logElementDetails = true;

/**
 * Returns the text the voiceover should read out
 */
export function getReadout(element: HTMLElement): string {
	// Should the TTS read out the element name first or the element contents first?
	let elementFirst = true;
	let elementName = '';
	let elementContent = undefined; // if element content is undefined, default to textContent. It will be undefined when it comes to elements like p, a, etc, but not so for img; this will be set to alt text, for example.

	let labelledByOtherElement = false;

	let p;
	if ((p = element.getAttribute('aria-labelledby'))) {
		// Try to find element by ID. If that doesn't work, search by class
		const labelElement = document.getElementById(p) ?? document.querySelector('.' + p);
		elementContent = labelElement?.textContent;

		if (labelElement) labelledByOtherElement = true;

		console.log('Labeled by:', labelElement, '; element content: ', elementContent);
	}

	switch (element.tagName.toLowerCase()) {
		case 'a':
			// If the link itself doesn't have any content, run a query selector on the first element with either alt or aria-label on it and re-run this function with it
			elementName = 'link';

			if (!labelledByOtherElement) elementContent = element.innerText ?? '';

			// If the link has no text content and no label, search for that in its children
			if (elementContent === '' && !element.getAttribute('aria-label')) {
				const firstChildWithInfo = element.querySelector('[alt], [aria], [aria-labelledby]') as HTMLElement;
				if (firstChildWithInfo) return getReadout(firstChildWithInfo as HTMLElement);
			}
			break;
		case 'p':
			elementName = 'text';

			elementContent = element.innerText;
			break;
		case 'svg':
		case 'img':
			elementFirst = false;

			elementName = 'image';
			if (!labelledByOtherElement) elementContent = element.getAttribute('alt') ?? '';
			break;
		case 'button':
			elementFirst = false;

			elementName = 'button';
			break;
		default:
			console.warn('unknown element type: "' + element.tagName.toLowerCase().trim() + '" element:', element);
			// If dealing with element not listed, return empty string (ignore it)
			if (!elementContent) return '';
	}

	if (elementContent === '' || !elementContent) elementContent = element.getAttribute('aria-label') ?? '';

	if (logElementDetails) console.log('Element content: ', elementContent, element.getAttribute('aria-label'), element);

	// Semicolons make the voiceover wait for a bit before continuing
	if (elementFirst) return elementName + '; ' + elementContent;
	else return elementContent + '; ' + elementName;
}