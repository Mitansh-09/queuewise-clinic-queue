'use client'

import { FormEvent, useState } from 'react'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

const topics = [
  { name: 'Breast cancer', group: 'Cancer', summary: 'Learn about signs and symptoms, risk factors, screening, diagnosis, and treatment.' },
  { name: 'Type 2 diabetes', group: 'Metabolic health', summary: 'Understand the condition, common factors, testing, and day-to-day care.' },
  { name: 'Asthma', group: 'Breathing', summary: 'Explore common symptoms, triggers, and ways asthma is managed.' },
  { name: 'High blood pressure', group: 'Heart health', summary: 'Understand blood pressure, possible health effects, and care.' },
]

type SearchTopic = { title: string; group: string; points: string[]; url: string }

export default function HealthLibraryPage() {
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [results, setResults] = useState<SearchTopic[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  async function searchTopic(value: string) {
    const term = value.trim()
    if (term.length < 2) {
      setError('Type at least two letters to search health topics.')
      return
    }
    setQuery(term)
    setError('')
    setLoading(true)
    setResults([])
    setHasSearched(true)
    try {
      const response = await fetch(`/api/health-library?term=${encodeURIComponent(term)}`)
      const payload = await response.json() as { topics?: SearchTopic[]; error?: string }
      if (!response.ok) throw new Error(payload.error || 'Health topics could not be loaded.')
      setResults(payload.topics || [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Health topics could not be loaded. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void searchTopic(query)
  }

  return <main className="library-page"><div className="shell"><SiteHeader />
    <section className="library-hero">
      <p className="eyebrow">MedVault health library</p>
      <h1>Clear information to help you prepare.</h1>
      <p>Find short, source-based health summaries here in MedVault. Search a topic or start with a common condition; links to original sources are optional if you want more detail.</p>
      <form className="library-search" onSubmit={search}>
        <label htmlFor="health-topic-search">Search a disease or health topic</label>
        <div><input id="health-topic-search" value={query} onChange={(event) => { setQuery(event.target.value); setError(''); setResults([]); setHasSearched(false) }} placeholder="For example, diabetes" maxLength={120} /><button className="button button-primary" type="submit" disabled={loading}>{loading ? 'Searching…' : 'Search topics'}</button></div>
        <p className="library-privacy">MedVault sends this topic search to MedlinePlus to retrieve public information. It is not saved to your MedVault account. Avoid entering names, personal details, or identifying symptoms.</p>
        {error && <p className="form-message error" role="alert">{error}</p>}
      </form>
    </section>

    {(loading || hasSearched) && <section className="library-results" aria-live="polite" aria-labelledby="library-results-heading">
      <div className="library-section-heading"><div><p className="eyebrow">MedlinePlus search</p><h2 id="library-results-heading">{loading ? 'Finding health topics…' : error ? 'Could not load topics' : results.length ? 'Health information' : 'No matching topics found'}</h2></div><p>Short summaries from the National Library of Medicine. Select a source only if you want more detail.</p></div>
      {results.length > 0 && <div className="library-results-list">{results.map((topic) => <article className="library-result-card" key={topic.url}><div className="library-result-heading"><p className="eyebrow">{topic.group}</p><h3>{topic.title}</h3></div>{topic.points.length > 0 ? <ul>{topic.points.map((point, index) => <li key={`${topic.url}-${index}`}>{point}</li>)}</ul> : <p>This source has more information on the topic. Open it to read the overview.</p>}<p className="library-result-source">Source: MedlinePlus, National Library of Medicine</p><a className="text-action" href={topic.url} target="_blank" rel="noreferrer">Read more at source</a></article>)}</div>}
      {!loading && results.length === 0 && !error && <p className="library-no-results">Try a broader or more common topic name. No summary is created when the source does not return a match.</p>}
    </section>}

    <section className="library-section" aria-labelledby="starter-topics">
      <div className="library-section-heading"><div><p className="eyebrow">Browse</p><h2 id="starter-topics">Common starting points</h2></div><p>For more conditions, use the MedlinePlus search above. Its health topics are maintained by the National Library of Medicine.</p></div>
      <div className="library-grid">{topics.map((topic) => <article className="library-card" key={topic.name}><p className="eyebrow">{topic.group}</p><h3>{topic.name}</h3><p>{topic.summary}</p><button className="text-action" type="button" onClick={() => void searchTopic(topic.name)}>See short summary</button></article>)}</div>
    </section>

    <section className="library-feature" aria-labelledby="breast-cancer-basics">
      <div><p className="eyebrow">A careful example</p><h2 id="breast-cancer-basics">Breast cancer: what is known</h2><p>Breast cancer begins when cells in breast tissue grow abnormally. A breast lump or other change can have many causes; only a qualified health professional can assess it.</p></div>
      <div className="library-facts">
        <article><h3>Risk is not a prediction</h3><p>Age, inherited gene changes, family history, and some other factors can affect risk. A risk factor does not mean someone will develop cancer, and people can develop it without known risk factors.</p></article>
        <article><h3>No guaranteed prevention</h3><p>There is no sure way to prevent breast cancer. Some choices and medical options may lower risk for some people, but they do not remove risk. Ask a clinician about personal risk and screening.</p></article>
        <article><h3>When to seek care</h3><p>A new lump or a persistent breast or nipple change should be discussed with a clinician. This information cannot determine the cause or replace an examination.</p></article>
      </div>
      <p className="library-source-note">Based on patient information from the US National Cancer Institute. Its risk factors page was updated December 2, 2025. Risk and screening recommendations depend on the individual and may change as evidence develops.</p>
      <div className="library-source-links"><a href="https://www.cancer.gov/types/breast/causes-risk-factors" target="_blank" rel="noreferrer">NCI: Risk factors</a><a href="https://www.cancer.gov/types/breast/symptoms" target="_blank" rel="noreferrer">NCI: Signs and symptoms</a><a href="https://www.cancer.gov/types/breast/causes-risk-factors/prevention" target="_blank" rel="noreferrer">NCI: Risk reduction</a></div>
    </section>

    <aside className="library-boundary"><strong>General education, not a personal medical answer.</strong><p>This library does not diagnose, estimate your personal risk, recommend a treatment, or guarantee that a condition can be prevented or cured. Health information may not include every situation. For personal advice, speak with a qualified healthcare professional. If you may be having an emergency, contact local emergency services now.</p></aside>
    <SiteFooter />
  </div></main>
}
