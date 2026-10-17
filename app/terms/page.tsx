import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

export default function TermsPage() {
  return <main className="shell"><SiteHeader /><article className="legal-page"><p className="eyebrow">Terms of use</p><h1>Terms for using MedVault</h1><p className="legal-updated">Last updated: 17 October 2026</p>
    <p>MedVault is a student project demonstration. It is provided for learning and evaluation, not as a hospital information system or clinical service.</p>
    <h2>Not medical advice</h2><p>The care guide uses basic keyword matching to find listed specialties and a narrow set of red-flag phrases. Its urgency label is not clinical triage, may miss urgent symptoms, and must not be used to decide whether care can wait. It does not diagnose or recommend treatment. If you need urgent help in India, call 112 or visit an emergency department.</p>
    <h2>Health records and family profiles</h2><p>Only upload documents you are authorized to store. You are responsible for obtaining permission before creating a profile or recording information for another person. Personal health records in the vault are not shared with clinics through this version of MedVault.</p>
    <h2>Medication reminders</h2><p>Reminder times and dose logs are organizational aids. They do not validate a prescription, provide dosing guidance, or guarantee delivery of an alert. Follow the directions of the prescribing clinician and pharmacist.</p>
    <h2>Clinic listings and queues</h2><p>Clinician details are submitted by participating clinic staff and may be incomplete or out of date. Queue estimates can change as clinic sessions run. Confirm clinic availability and details directly with the clinic.</p>
    <h2>Account and availability</h2><p>Keep your credentials private and sign out on shared devices. The service may be unavailable or changed during development. Do not rely on it as the only copy of a medical record or as a source of emergency information.</p>
    <h2>Hospital use</h2><p>This project has not been reviewed for clinical safety, privacy law, security certification, or integration with hospital systems. A hospital must complete its own legal, security, clinical, and operational review before any real-world use.</p>
  </article><SiteFooter /></main>
}
