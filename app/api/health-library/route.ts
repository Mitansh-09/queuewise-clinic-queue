import { NextResponse } from 'next/server'

type Topic = { title: string; group: string; points: string[]; url: string }

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

function textFromMarkup(value: string) {
  return decodeXml(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseTopics(xml: string): Topic[] {
  const topics: Topic[] = []
  for (const match of xml.matchAll(/<document\b([^>]*)>([\s\S]*?)<\/document>/g)) {
    const attributes = match[1]
    const body = match[2]
    const rawUrl = attributes.match(/\burl="([^"]+)"/)?.[1]
    if (!rawUrl) continue
    let url: URL
    try { url = new URL(decodeXml(rawUrl)) } catch { continue }
    if (url.protocol !== 'https:' || !['medlineplus.gov', 'www.medlineplus.gov'].includes(url.hostname)) continue

    const fields = new Map<string, string[]>()
    for (const field of body.matchAll(/<content\b([^>]*)>([\s\S]*?)<\/content>/g)) {
      const name = field[1].match(/\bname="([^"]+)"/)?.[1]
      if (!name) continue
      const values = fields.get(name) || []
      values.push(textFromMarkup(field[2]))
      fields.set(name, values)
    }

    const title = fields.get('title')?.[0]
    if (!title) continue
    const sourceText = fields.get('FullSummary')?.[0] || fields.get('snippet')?.[0] || ''
    const sentences = sourceText.match(/[^.!?]+(?:[.!?]+|$)/g) || []
    const points = sentences.map((sentence) => sentence.trim()).filter((sentence) => sentence && !sentence.endsWith('?')).slice(0, 4)
    topics.push({ title, group: fields.get('groupName')?.[0] || 'Health topic', points, url: url.toString() })
    if (topics.length === 5) break
  }
  return topics
}

export async function GET(request: Request) {
  const term = new URL(request.url).searchParams.get('term')?.trim() || ''
  if (term.length < 2 || term.length > 120) {
    return NextResponse.json({ error: 'Search with a topic between 2 and 120 characters.' }, { status: 400 })
  }

  const serviceUrl = new URL('https://wsearch.nlm.nih.gov/ws/query')
  serviceUrl.searchParams.set('db', 'healthTopics')
  serviceUrl.searchParams.set('term', term)
  serviceUrl.searchParams.set('retmax', '5')
  serviceUrl.searchParams.set('rettype', 'brief')
  serviceUrl.searchParams.set('tool', 'medvault')

  try {
    const response = await fetch(serviceUrl, { next: { revalidate: 43200 }, signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error('Health information service unavailable')
    const topics = parseTopics(await response.text())
    return NextResponse.json({ topics, source: 'MedlinePlus, National Library of Medicine' }, {
      headers: { 'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=86400' },
    })
  } catch {
    return NextResponse.json({ error: 'The health topic service is temporarily unavailable. Please try again later.' }, { status: 502 })
  }
}
