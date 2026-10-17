// Pagefind excerpts are HTML with <mark> around hits. We never inject them: split on the mark
// tags into text parts and render those as text, so nothing from the index can become markup.
export interface Part {
  text: string;
  mark: boolean;
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'"
};

const decode = (s: string) => s.replace(/&(?:amp|lt|gt|quot|#39|#x27);/g, (m) => ENTITIES[m]!);

export function splitExcerpt(excerpt: string): Part[] {
  const parts: Part[] = [];
  let mark = false;
  // Odd chunks are the tags we split on; any other tag is dropped, never rendered.
  for (const chunk of excerpt.split(/(<\/?mark>)/i)) {
    if (/^<mark>$/i.test(chunk)) mark = true;
    else if (/^<\/mark>$/i.test(chunk)) mark = false;
    else {
      const text = decode(chunk.replace(/<[^>]*>/g, ''));
      if (text) parts.push({ text, mark });
    }
  }
  return parts;
}
