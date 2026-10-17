import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

export default function PrivacyPage() {
  return <main className="shell"><SiteHeader /><article className="legal-page"><p className="eyebrow">Privacy policy</p><h1>How MedVault handles personal information</h1><p className="legal-updated">Last updated: 17 October 2026</p>
    <p>MedVault is a student project and demonstration, not a hospital production service. Do not use it for urgent care or upload another person’s records unless you are authorized to manage them.</p>
    <h2>Information stored</h2><p>Account email and profile names are used for sign-in and account management. If you choose to use the health vault, it stores family profile names and optional dates of birth, record titles and dates, short notes, the files you upload, medication names and doses, reminder times, and dose logs. If you book a clinic token, the selected clinic receives the name and phone number entered for that booking.</p>
    <h2>Health records and access</h2><p>Uploaded files are held in a private storage bucket. Signed-in users can access records belonging to profiles in their own account. Doctor and clinic directory listings are visible to signed-in users. Clinic staff can manage directory listings and their clinic’s queue. The health vault does not share personal records or medication information with a doctor or clinic.</p>
    <h2>Care guide</h2><p>The care guide checks a short description against a small set of specialty keywords in your browser. It does not call an AI model, save the description to your account, send it to a clinic, diagnose a condition, or assess urgency. Keyword matches may be wrong or incomplete.</p>
    <h2>Hosting and processing</h2><p>This deployed project’s Supabase database and file storage are configured in the Australia (Sydney) region. Information may therefore be processed outside your country. The hosting setup has not been reviewed or certified for hospital use or any particular healthcare privacy framework.</p>
    <h2>Retention and deletion</h2><p>You can delete individual uploaded records from your vault. Account, appointment, and medication information may remain in provider backups for a limited period after deletion. To request account removal or ask a question about this student project, contact its administrator.</p>
    <h2>Security and limits</h2><p>Access rules restrict health records to the signed-in account that owns them. This project has not undergone an independent security or legal assessment. Do not treat this notice as a compliance certification or a substitute for a hospital’s privacy notice.</p>
  </article><SiteFooter /></main>
}
