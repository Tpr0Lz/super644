import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true
});

const RECOMMEND_REASON_LABEL = '\u63a8\u8350\u7406\u7531';
const SALARY_LABEL = '\u671f\u671b\u85aa\u8d44';
const DIRECTION_LABEL = '\u5339\u914d\u65b9\u5411';

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
    .trim();

  if (!text) {
    return '';
  }

  return text
    .replace(/^(#{1,6}\s.*)\s+-\s+(?=\*\*)/gm, '$1\n- ')
    .split('\n')
    .map((line) => formatCandidateBlock(line.trimEnd()))
    .join('\n');
}

export function renderAiMarkdown(rawText) {
  return marked.parse(normalizeAiMarkdown(rawText));
}
