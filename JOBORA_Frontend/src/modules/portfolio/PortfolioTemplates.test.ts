import assert from "node:assert/strict"
import test from "node:test"
import type { PortfolioData } from "../../api/portfolioApi"
import { createPortfolioPreviewSrcDoc, createStandalonePortfolioHtml } from "./PortfolioTemplates.tsx"

const portfolio: PortfolioData = {
  fullName: '<img src=x onerror="alert(1)">',
  title: "Développeuse",
  headline: '<script>alert("headline")</script>',
  availableForWork: true,
  showCvDownload: true,
  email: "fatma@example.test",
  phone: "",
  location: "",
  links: { linkedin: "", github: "", website: "" },
  sections: [
    { id: "home", visible: true, order: 0 },
    { id: "about", visible: true, order: 1 },
    { id: "skills", visible: true, order: 2 },
    { id: "experiences", visible: true, order: 3 },
    { id: "projects", visible: true, order: 4 },
    { id: "certifications", visible: true, order: 5 },
    { id: "contact", visible: true, order: 6 },
  ],
  theme: { accentColor: '"></style><script>alert("theme")</script>' },
  contactVisibility: { email: true, phone: false },
  about: '<svg onload="alert(1)"></svg>',
  education: [],
  experiences: [],
  projects: [{
    name: '<iframe src="javascript:alert(1)"></iframe>',
    year: "",
    description: "Projet",
    technologies: [],
  }],
  skills: { languages: [], frameworks: [], tools: [], databases: [], other: [] },
  languages: [],
  certifications: [],
}

test("standalone portfolio HTML escapes CV data and has no external assets", () => {
  const html = createStandalonePortfolioHtml(portfolio, "developer")

  assert.match(html, /&lt;script&gt;alert\(&quot;headline&quot;\)&lt;\/script&gt;/)
  assert.match(html, /&lt;svg onload=&quot;alert\(1\)&quot;&gt;&lt;\/svg&gt;/)
  assert.match(html, /&lt;iframe src=&quot;javascript:alert\(1\)&quot;&gt;&lt;\/iframe&gt;/)
  assert.doesNotMatch(html, /<script\b|<img\b|<svg\b|<iframe\b/i)
  assert.doesNotMatch(html, /<\/style><script/i)
  assert.doesNotMatch(html, /<link\b|https:\/\/(?:fonts\.|cdn\.)/i)
  assert.match(html, /--accent:#5b5bd6/)
  assert.match(html, /<style>[\s\S]*<\/style>/)
})

test("portfolio preview fixes a light color scheme independent from the app theme", () => {
  const srcDoc = createPortfolioPreviewSrcDoc(portfolio, "developer")

  assert.match(srcDoc, /:root \{ color-scheme:light; \}/)
  assert.match(srcDoc, /html,body \{ background:#f1f3f8; \}/)
  assert.doesNotMatch(srcDoc, /data-theme=["']dark["']/)
})
