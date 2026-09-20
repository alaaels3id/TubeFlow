/**
 * Formats release notes whether they come as markdown, HTML, or mixed text.
 * Sanitizes potentially unsafe HTML and wraps lists and headers for consistent presentation.
 */
export function formatReleaseNotes(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  let text = raw.trim();

  // If text doesn't contain HTML tags, convert basic markdown to HTML
  const hasHtml = /<[a-z][\s\S]*>/i.test(text);

  if (!hasHtml) {
    text = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headers
      .replace(/^#### (.*$)/gim, '<h5>$1</h5>')
      .replace(/^### (.*$)/gim, '<h4>$1</h4>')
      .replace(/^## (.*$)/gim, '<h3>$1</h3>')
      .replace(/^# (.*$)/gim, '<h2>$1</h2>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // List items
      .replace(/^\s*[-*•]\s+(.*$)/gim, '<li>$1</li>')
      // Linebreaks
      .replace(/\n\n/g, '<br/>')
      .replace(/\n/g, '<br/>');

    // Group adjacent <li> into <ul>
    text = text.replace(/(<li>[\s\S]*?<\/li>)+/gi, (match) => `<ul>${match}</ul>`);
  } else {
    // Sanitize existing HTML by stripping dangerous tags and scripts
    text = text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/\son\w+="[^"]*"/gi, '')
      .replace(/\son\w+='[^']*'/gi, '')
      .replace(/\son\w+=\w+/gi, '');
  }

  return text;
}
