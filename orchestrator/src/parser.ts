export interface ParsedIdea {
  text: string;
  link?: string;
}

const URL_REGEX = /^https?:\/\/\S+$/;

export function parseIdeas(content: string): ParsedIdea[] {
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const ideas: ParsedIdea[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (URL_REGEX.test(line)) {
      // Orphan URL with no preceding idea — skip
      i++;
      continue;
    }

    const idea: ParsedIdea = { text: line };

    // Peek at the next line: if it's a URL, attach it
    if (i + 1 < lines.length && URL_REGEX.test(lines[i + 1])) {
      idea.link = lines[i + 1];
      i += 2;
    } else {
      i++;
    }

    ideas.push(idea);
  }

  return ideas;
}
