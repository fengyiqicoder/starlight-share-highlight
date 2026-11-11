/**
 * starlight-share-highlight: select text in Starlight docs to copy a link that jumps to and
 * highlights exactly that text, or copy it as a quote with a link back.
 *
 *   import starlightShareHighlight from "starlight-share-highlight";
 *   starlight({ plugins: [starlightShareHighlight()] })
 */
import { makeAccessory } from './plugin.js';

export default function starlightShareHighlight(options = {}) {
	return makeAccessory('starlight-share-highlight', {
		actions: options.actions ?? ['link', 'quote'],
		minChars: options.minChars ?? 3,
		maxChars: options.maxChars ?? 1500,
		labels: options.labels ?? {},
		ai: options.ai ?? false,
	});
}
