let audioCtx: AudioContext | undefined;
let panner: PannerNode | undefined;

const meSpeak = require('mespeak');
meSpeak.loadConfig(require('../public/mespeak-config.json'));
meSpeak.loadVoice(require('mespeak/voices/en/en-us.json'));

let pitchConst = 350;

const params: any = new Proxy(new URLSearchParams(window.location.search), {
	get: (searchParams: URLSearchParams, prop: string) => searchParams.get(prop)
});
const spatialAudioEnabled: boolean = params.spatialAudio !== 'false';

/** Sets the position of the PannerNode. */
export function setPannerPosition(x: number = 0, y: number = 0, z: number = 5): void {
	if (!panner) {
		console.error("Panner has not been initialized; make sure to only call setPannerPosition() once you're the audioContext has been initialized!");
		return;
	}

	panner.positionX.value = x * 20;
	panner.positionY.value = y;
	panner.positionZ.value = z;

	//console.log('Panner Position', panner.positionX.value, panner.positionY.value, panner.positionZ.value);
	//console.log('Listener Position', audioCtx.listener.positionX.value, audioCtx.listener.positionY.value, audioCtx.listener.positionZ.value);
}

let lastSoundSource: { sourceNode: AudioBufferSourceNode; id: number } | undefined;
let soundPromiseRejectMethods: Map<number, Function> = new Map();
let soundsPlayed = 0;
let sources: AudioBufferSourceNode[] = [];

/** Plays a sound file in a spatialized manner given the file path of the audio file. (e.g. 'h1.mp3') */
export async function playSound(bias: { x: number; y: number }, text: string): Promise<void> {
	// Don't waste any resources with empty strings.
	if (text === '') return;

	if (!audioCtx) {
		audioCtx = new AudioContext();
		panner = audioCtx.createPanner();
	}

	console.log('Spatial Audio', spatialAudioEnabled);

	return new Promise(async (resolve, reject) => {
		await audioCtx!.resume();

		const id = soundsPlayed++;

		soundPromiseRejectMethods.set(id, reject);

		//Prevent multiple sounds from playing at the same time
		try {
			if (lastSoundSource !== undefined) {
				lastSoundSource.sourceNode.stop();

				//Reject last sound's promise
				soundPromiseRejectMethods.get(lastSoundSource.id)!(lastSoundSource.id);
				soundPromiseRejectMethods.delete(lastSoundSource.id);

				lastSoundSource = undefined;
			}

			for (let i = 0; i < sources.length; i++) {
				const source = sources[i];

				if (source) {
					source.stop();
				}
			}
		} catch {
			reject();
			//Possible error: InvalidStateNode (DOMException) Thrown if the node has not been started by calling start(). (https://developer.mozilla.org/en-US/docs/Web/API/AudioScheduledSourceNode/stop)
			//This error isn't important. A try/catch block is used to help keep the console neater until a better method of solving this issue is found.
		}

		//Gets audio file from imported path
		//const audioFile = await getFile(audioFilePath, 'dirAudio');

		let source = audioCtx!.createBufferSource();
		lastSoundSource = { sourceNode: source, id: id };
		sources.push(source);

		// Original Solution (pre-recorded mp3 files)
		// source.buffer = await audioCtx.decodeAudioData(await audioFile.arrayBuffer());

		// Using MeSpeak
		source.buffer = await audioCtx!.decodeAudioData(meSpeak.speak(text, { rawdata: true }));

		source.onended = () => {
			lastSoundSource = undefined;
			resolve();
		};

		//Modifies pitch based on provided y-value
		if (spatialAudioEnabled) {
			//console.log(bias.x, bias.y);
			setPannerPosition(bias.x, bias.y);
		}

		source.detune.value = pitchConst * panner!.positionY.value;

		if (bias.x === 0 || !spatialAudioEnabled) {
			source.connect(audioCtx!.destination);
		} else {
			var gainNode = audioCtx!.createGain();

			gainNode.gain.value = 20 + Math.abs(bias.x); //Gain increases as distance from center increases to help balance out volume levels

			source.connect(gainNode).connect(panner!).connect(audioCtx!.destination);
		}

		source.start(0);
	});
}

/** Gets the horizontal/vertical bias of an onscreen element. Returns x/y biases bounded by -1 & 1. (0 signifies center of screen) */
export function getBias(element: HTMLElement, roundToTenth = true): { x: number; y: number } {
	const rect = element.getBoundingClientRect();

	// Get midpoint of element (https://javascript.info/coordinates)
	const midpoint = { x: rect.left + rect.width / 2, y: rect.bottom - rect.height / 2 };

	//console.log('width:', window.innerWidth, 'height:', window.innerHeight, 'midpoint:', midpoint, 'scroll pos:', window.scrollY);

	const bias = { x: midpoint.x / window.innerWidth, y: midpoint.y / window.innerHeight };

	let xBias = -1 + 2 * bias.x;
	let yBias = 1 - 2 * bias.y;

	// If the element is not on screen, set the yBias to 0. This can easily be changed if we ever want to handle this edge case differently
	if (yBias > 1 || yBias < -1) yBias = 0;

	if (roundToTenth) {
		xBias = Math.round(xBias * 10) / 10;
		yBias = Math.round(yBias * 10) / 10;
	}

	return { x: xBias, y: yBias };
}