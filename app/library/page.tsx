'use client'

import { FormEvent, useState } from 'react'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

const topics = [
  { name: 'Breast cancer', group: 'Cancer', href: 'https://www.cancer.gov/types/breast', summary: 'Learn about signs and symptoms, risk factors, screening, diagnosis, and treatment from the US National Cancer Institute.' },
  { name: 'Type 2 diabetes', group: 'Metabolic health', href: 'https://medlineplus.gov/diabetestype2.html', summary: 'Read about the condition, testing, treatment, and day-to-day care from the US National Library of Medicine.' },
  { name: 'Asthma', group: 'Breathing', href: 'https://medlineplus.gov/asthma.html', summary: 'Explore common symptoms, diagnosis, medicines, and ways to manage asthma.' },
  { name: 'High blood pressure', group: 'Heart health', href: 'https://medlineplus.gov/highbloodpressure.html', summary: 'Understand blood pressure, possible health effects, measurement, and treatment.' },
]

export default function HealthLibraryPage() {
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const term = query.trim()
    if (term.length < 2) {
      setError('Type at least two letters to search health topics.')
      return
    }
    const url = new URL('https://connect.medlineplus.gov/application')
    url.searchParams.set('mainSearchCriteria.v.dn', term)
    url.searchParams.set('informationRecipient.languageCode.c', 'en')
    window.location.assign(url.toString())
  }

  return <main className="library-page"><div className="shell"><SiteHeader />
    <section className="library-hero">
      <p className="eyebrow">MedVault health library</p>
      <h1>Clear information to help you prepare.</h1>
      <p>Search health topics through MedlinePlus, a service of the US National Library of Medicine, or start with these common topics. Information is educational and cannot tell you what condition you have.</p>
      <form className="library-search" onSubmit={search}>
        <label htmlFor="health-topic-search">Search a disease or health topic</label>
        <div><input id="health-topic-search" value={query} onChange={(event) => { setQuery(event.target.value); setError('') }} placeholder="For example, breast cancer" maxLength={120} /><button className="button button-primary" type="submit">Search MedlinePlus</button></div>
        <p className="library-privacy">Your search opens MedlinePlus. The search term is sent to that service so it can return relevant public health information. Do not enter personal details or symptoms that identify you.</p>
        {error && <p className="form-message error" role="alert">{error}</p>}
      </form>
    </section>

    <section className="library-section" aria-labelledby="starter-topics">
      <div className="library-section-heading"><div><p className="eyebrow">Browse</p><h2 id="starter-topics">Common starting points</h2></div><p>For more conditions, use the MedlinePlus search above. Its health topics are maintained by the National Library of Medicine.</p></div>
      <div className="library-grid">{topics.map((topic) => <article className="library-card" key={topic.name}><p className="eyebrow">{topic.group}</p><h3>{topic.name}</h3><p>{topic.summary}</p><a className="text-action" href={topic.href} target="_blank" rel="noreferrer">Read the source</a></article>)}</div>
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
