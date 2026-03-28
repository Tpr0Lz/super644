import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true
});

const RECOMMEND_REASON_LABEL = '\u63a8\u8350\u7406\u7531';
const SALARY_LABEL = '\u671f\u671b\u85aa\u8d44';
const DIRECTION_LABEL = '\u5339\u914d\u65b9\u5411';

function normalizeLine(line) {
  const text = String(line || '')
    .replace(/\u0000/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trimEnd();

  if (!text) {
    return '';
  }

  const headingMatch = text.match(/^\s*#{1,6}\s+(.+?)\s*$/);
  if (headingMatch) {
    return `**${headingMatch[1].trim()}**`;
  }

  return text;
}

function formatCandidateBlock(line) {
  const match = line.match(
    new RegExp(
      `^-\\s+\\*\\*(.+?)\\*\\*\\s*\\|\\s*([^|]+?)\\s*\\|\\s*(.+?)(?:\\s*-\\s*\\*\\*${RECOMMEND_REASON_LABEL}\\*\\*[\\uff1a:]\\s*(.+))?$`
    )
  );

  if (!match) {
    return line;
  }

  const [, name, salary, direction, reason = ''] = match;
  const output = [
    `- **${name.trim()}**`,
    `  - ${SALARY_LABEL}\uff1a${salary.trim()}`,
    `  - ${DIRECTION_LABEL}\uff1a${direction.trim()}`
  ];

  if (reason.trim()) {
    output.push(`  - ${RECOMMEND_REASON_LABEL}\uff1a${reason.trim()}`);
  }

  return output.join('\n');
}

export function normalizeAiMarkdown(rawText) {
  const text = String(rawText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\u0000/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();

  if (!text) {
    return '';
  }

  return text
    .replace(/^(#{1,6}\s.*)\s+-\s+(?=\*\*)/gm, '$1\n- ')
    .split('\n')
    .map((line) => formatCandidateBlock(normalizeLine(line)))
    .join('\n');
}

export function renderAiMarkdown(rawText) {
  return marked.parse(normalizeAiMarkdown(rawText));
}
