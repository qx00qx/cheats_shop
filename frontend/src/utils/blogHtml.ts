import DOMPurify from "dompurify";

const BLOG_HTML_OPTIONS = {
  ALLOWED_TAGS: [
    "a", "b", "blockquote", "br", "code", "div", "em", "h2", "h3", "h4",
    "hr", "i", "li", "ol", "p", "pre", "s", "strong", "u", "ul",
  ],
  ALLOWED_ATTR: ["href", "title"],
};

export function sanitizeBlogHtml(value: string): string {
  return DOMPurify.sanitize(value, BLOG_HTML_OPTIONS);
}
