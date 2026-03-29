import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true
});

const CANDIDATE_TITLE = '\u63a8\u8350\u5019\u9009\u4eba';
const JOB_TITLE = '\u63a8\u8350\u5c97\u4f4d';

const CANDIDATE_NAME = '\u59d3\u540d';
const CANDIDATE_SALARY = '\u671f\u671b\u85aa\u8d44';
const CANDIDATE_STRENGTH = '\u4e2a\u4eba\u4f18\u52bf';
const CANDIDATE_REASON = '\u63a8\u8350\u7406\u7531';

const JOB_NAME = '\u5c97\u4f4d\u540d';
const JOB_SALARY = '\u85aa\u8d44';
const JOB_LOCATION = '\u4f4d\u7f6e';
const JOB_REQUIREMENT = '\u5c97\u4f4d\u8981\u6c42';
const JOB_REASON = '\u63a8\u8350\u7406\u7531';

function cleanText(value) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function normalizeLine(line) {
  const text = cleanText(line).trimEnd();
  if (!text) {
    return '';
  }

  const headingMatch = text.match(/^#{1,6}\s*(.+?)\s*$/);
  if (headingMatch) {
    return headingMatch[1].trim();
  }

  return text;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripWrappingPunctuation(value) {
  return String(value || '')
    .trim()
    .replace(/^[（(【\[]\s*/, '')
    .replace(/\s*[）)】\]]$/, '')
    .trim();
}

function normalizeSeparatorMarkdown(text) {
  return text
    .replace(/^\s*---+\s*$/gm, '\n---\n')
    .replace(/\n{3,}/g, '\n\n');
}

function isLinkLine(line) {
  return /^\[.+\]\((https?:\/\/|\/).+\)$/.test(line) || /^-\s*\[.+\]\((https?:\/\/|\/).+\)$/.test(line);
}

function normalizeLinkLine(line) {
  return line.replace(/^\s*-\s*/, '').trim();
}

function parseField(line, label) {
  const pattern = new RegExp(
    `^(?:[-*]\\s*)?\\*{0,2}${escapeRegExp(label)}\\*{0,2}\\s*[：:]\\s*(.+)$`
  );
  const match = line.match(pattern);
  if (!match) {
    return null;
  }
  return stripWrappingPunctuation(match[1]);
}

function parseJobBulletField(line, label) {
  const pattern = new RegExp(`^[-*]\\s*${escapeRegExp(label)}[（(]\\s*(.+?)\\s*[）)]\\s*$`);
  const match = line.match(pattern);
  if (!match) {
    return null;
  }
  return stripWrappingPunctuation(match[1]);
}

function isSectionTitle(line, label) {
  const text = normalizeLine(line).replace(/\*+/g, '').trim();
  return text === label;
}

function formatCandidateItem(item) {
  const lines = [`- **${item.name || '-'}**`];

  if (item.salary) {
    lines.push(`  - ${CANDIDATE_SALARY}：${item.salary}`);
  }
  if (item.strength) {
    lines.push(`  - ${CANDIDATE_STRENGTH}：${item.strength}`);
  }
  if (item.reason) {
    lines.push(`  - ${CANDIDATE_REASON}：${item.reason}`);
  }
  if (item.link) {
    lines.push(`  - ${item.link}`);
  }

  return lines.join('\n');
}

function formatJobItem(item) {
  const lines = [`- **${item.name || '-'}**`];

  if (item.salary) {
    lines.push(`  - ${JOB_SALARY}：${item.salary}`);
  }
  if (item.location) {
    lines.push(`  - ${JOB_LOCATION}：${item.location}`);
  }
  if (item.requirement) {
    lines.push(`  - ${JOB_REQUIREMENT}：${item.requirement}`);
  }
  if (item.reason) {
    lines.push(`  - ${JOB_REASON}：${item.reason}`);
  }
  if (item.link) {
    lines.push(`  - ${item.link}`);
  }

  return lines.join('\n');
}

function collectIndentedText(lines, startIndex, initialValue) {
  let value = String(initialValue || '').trim();
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      break;
    }
    if (isLinkLine(line) || line === '---') {
      break;
    }
    if (
      parseField(line, CANDIDATE_NAME) !== null ||
      parseField(line, CANDIDATE_SALARY) !== null ||
      parseField(line, CANDIDATE_STRENGTH) !== null ||
      parseField(line, CANDIDATE_REASON) !== null ||
      parseJobBulletField(line, JOB_NAME) !== null ||
      parseJobBulletField(line, JOB_SALARY) !== null ||
      parseJobBulletField(line, JOB_LOCATION) !== null ||
      parseJobBulletField(line, JOB_REQUIREMENT) !== null ||
      parseJobBulletField(line, JOB_REASON) !== null ||
      isSectionTitle(line, CANDIDATE_TITLE) ||
      isSectionTitle(line, JOB_TITLE)
    ) {
      break;
    }

    value = `${value} ${line.trim()}`.trim();
    index += 1;
  }

  return { value, nextIndex: index };
}

function parseCandidateSection(lines, startIndex) {
  const items = [];
  let index = startIndex + 1;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (isSectionTitle(line, JOB_TITLE)) {
      break;
    }

    const name = parseField(line, CANDIDATE_NAME);
    if (name === null) {
      index += 1;
      continue;
    }

    const item = {
      name,
      salary: '',
      strength: '',
      reason: '',
      link: ''
    };

    index += 1;

    while (index < lines.length) {
      const current = lines[index];

      if (!current.trim()) {
        index += 1;
        continue;
      }
      if (current === '---') {
        index += 1;
        break;
      }
      if (isSectionTitle(current, JOB_TITLE) || parseField(current, CANDIDATE_NAME) !== null) {
        break;
      }
      if (isLinkLine(current)) {
        item.link = normalizeLinkLine(current);
        index += 1;
        continue;
      }

      const salary = parseField(current, CANDIDATE_SALARY);
      if (salary !== null) {
        item.salary = salary;
        index += 1;
        continue;
      }

      const strength = parseField(current, CANDIDATE_STRENGTH);
      if (strength !== null) {
        const collected = collectIndentedText(lines, index + 1, strength);
        item.strength = collected.value;
        index = collected.nextIndex;
        continue;
      }

      const reason = parseField(current, CANDIDATE_REASON);
      if (reason !== null) {
        const collected = collectIndentedText(lines, index + 1, reason);
        item.reason = collected.value;
        index = collected.nextIndex;
        continue;
      }

      index += 1;
    }

    items.push(formatCandidateItem(item));
  }

  if (!items.length) {
    return { text: `### ${CANDIDATE_TITLE}`, nextIndex: startIndex + 1 };
  }

  return {
    text: `### ${CANDIDATE_TITLE}\n\n${items.join('\n\n---\n\n')}`,
    nextIndex: index
  };
}

function parseJobSection(lines, startIndex) {
  const items = [];
  let index = startIndex + 1;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (isSectionTitle(line, CANDIDATE_TITLE)) {
      break;
    }

    const name = parseJobBulletField(line, JOB_NAME);
    if (name === null) {
      index += 1;
      continue;
    }

    const item = {
      name,
      salary: '',
      location: '',
      requirement: '',
      reason: '',
      link: ''
    };

    index += 1;

    while (index < lines.length) {
      const current = lines[index];

      if (!current.trim()) {
        index += 1;
        continue;
      }
      if (current === '---') {
        index += 1;
        break;
      }
      if (isSectionTitle(current, CANDIDATE_TITLE) || parseJobBulletField(current, JOB_NAME) !== null) {
        break;
      }
      if (isLinkLine(current)) {
        item.link = normalizeLinkLine(current);
        index += 1;
        continue;
      }

      const salary = parseJobBulletField(current, JOB_SALARY);
      if (salary !== null) {
        item.salary = salary;
        index += 1;
        continue;
      }

      const location = parseJobBulletField(current, JOB_LOCATION);
      if (location !== null) {
        item.location = location;
        index += 1;
        continue;
      }

      const requirement = parseJobBulletField(current, JOB_REQUIREMENT);
      if (requirement !== null) {
        const collected = collectIndentedText(lines, index + 1, requirement);
        item.requirement = collected.value;
        index = collected.nextIndex;
        continue;
      }

      const reason = parseJobBulletField(current, JOB_REASON);
      if (reason !== null) {
        const collected = collectIndentedText(lines, index + 1, reason);
        item.reason = collected.value;
        index = collected.nextIndex;
        continue;
      }

      index += 1;
    }

    items.push(formatJobItem(item));
  }

  if (!items.length) {
    return { text: `### ${JOB_TITLE}`, nextIndex: startIndex + 1 };
  }

  return {
    text: `### ${JOB_TITLE}\n\n${items.join('\n\n---\n\n')}`,
    nextIndex: index
  };
}

function transformTemplateSections(text) {
  const lines = normalizeSeparatorMarkdown(text)
    .split('\n')
    .map((line) => normalizeLine(line));
  const output = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      output.push('');
      index += 1;
      continue;
    }

    if (isSectionTitle(line, CANDIDATE_TITLE)) {
      const section = parseCandidateSection(lines, index);
      output.push(section.text);
      index = section.nextIndex;
      continue;
    }

    if (isSectionTitle(line, JOB_TITLE)) {
      const section = parseJobSection(lines, index);
      output.push(section.text);
      index = section.nextIndex;
      continue;
    }

    output.push(line);
    index += 1;
  }

  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function normalizeAiMarkdown(rawText) {
  const text = cleanText(rawText);
  if (!text) {
    return '';
  }

  return transformTemplateSections(text);
}

export function renderAiMarkdown(rawText) {
  return marked.parse(normalizeAiMarkdown(rawText));
}
