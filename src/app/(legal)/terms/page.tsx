import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import { LegalPage, Section, Ul } from "@/components/Legal";

export const metadata: Metadata = { title: "Terms & Conditions — Ebookvox", description: "The rules for using Ebookvox as a reader or a publisher.", alternates: { canonical: `${LEGAL.readerUrl}/terms` } };

export default function Terms() {
  const mail = <a href={`mailto:${LEGAL.email}`} className="font-medium text-accent hover:underline">{LEGAL.email}</a>;
  return (
    <LegalPage
      title="Terms & Conditions"
      updated={LEGAL.updated}
      intro="These terms are the agreement between you and Ebookvox when you use our Reader, our mobile apps, the Publisher site or our website. Please read them. By creating an account or using Ebookvox you agree to them."
    >
      <Section n={1} title="Who can use Ebookvox">
        <p>You must be old enough to form a binding contract where you live, and at least 13 years old. If you use Ebookvox for a company or organisation, you confirm you can accept these terms for it. You must give true information when you sign up and keep your password safe. You are responsible for what happens in your account.</p>
      </Section>

      <Section n={2} title="Reading, listening and your library">
        <p>Ebookvox lets you read books and listen to them, and turn text and documents you add into speech. Books you buy or add to your library are licensed to you for your own personal, non-commercial use. You may not copy, resell, share, record for distribution or publicly perform them. Voices are computer-generated.</p>
      </Section>

      <Section n={3} title="Documents and text you upload">
        <p>You keep ownership of what you upload. You promise that you have the right to use it with Ebookvox and that it does not break the law or anyone else’s rights. You allow us to process it, including by sending it to our speech provider, only to provide the read-aloud service to you. Do not upload anything unlawful, harmful or that you do not have the right to use.</p>
      </Section>

      <Section n={4} title="Prices, payments and your wallet">
        <Ul>
          <li>Prices are shown in your local currency, converted from US dollars at an exchange rate we use at the time. The amount you pay is shown before you confirm.</li>
          <li>Card payments are processed by Paystack. You agree to Paystack’s terms when you pay.</li>
          <li>You can top up a wallet and use it to pay for books and subscriptions. Wallet money is for use on Ebookvox and is not a bank account or a deposit.</li>
          <li>Taxes may apply and are your responsibility unless we say they are included.</li>
        </Ul>
      </Section>

      <Section n={5} title="Subscriptions (ad-free)">
        <Ul>
          <li>An Ebookvox subscription removes advertising from your Reader account. The standard price is US$2 per month, or US$1.80 per month when you choose the yearly plan (billed as one yearly amount), shown in your local currency.</li>
          <li>Paying by card extends your subscription for the period you bought. It does not renew automatically, so you will need to pay again to continue. If you pay from your wallet you can switch on automatic renewal and switch it off at any time on the Subscription page.</li>
          <li>If you buy before your current period ends, the new period is added to the end of it.</li>
          <li>Payments are not refundable once a period has started, except where the law gives you a right to a refund or where we made an error.</li>
        </Ul>
        <p>See <Link href="/subscribe" className="font-medium text-accent hover:underline">the Subscription page</Link> for current prices.</p>
      </Section>

      <Section n={6} title="Advertising">
        <p>Accounts without a subscription see advertising, including a short video ad before narration starts. We do not control the content of third-party ads. How ads use your information is explained in our <Link href="/privacy" className="font-medium text-accent hover:underline">Privacy Policy</Link>.</p>
      </Section>

      <Section n={7} title="Publishers">
        <p>If you publish books through the Ebookvox Publisher site, these extra terms apply:</p>
        <Ul>
          <li><strong>Your content.</strong> You confirm you own, or are licensed to sell, everything you upload, including text and covers, and that it does not infringe anyone’s rights, is not unlawful and does not mislead readers. You give us a licence to host, display, convert to speech and sell your books through Ebookvox.</li>
          <li><strong>Review.</strong> We may review, reject, suspend or remove any book, for example for rights complaints, quality or safety, or a breach of these terms.</li>
          <li><strong>Revenue share.</strong> You receive 85% of the sale price of each book sold, after any payment processing costs or taxes we are required to deduct. Ebookvox keeps 15%.</li>
          <li><strong>Payouts.</strong> We pay out available earnings to the payout details you give us, subject to any minimum amounts, verification and checks we apply. You are responsible for your own taxes and for keeping your payout details correct.</li>
          <li><strong>Refunds and reversals.</strong> If a sale is refunded, reversed or found to be fraudulent, we may deduct the related amount from your balance or future payouts.</li>
        </Ul>
      </Section>

      <Section n={8} title="Acceptable use">
        <p>You agree not to:</p>
        <Ul>
          <li>break the law or infringe anyone’s rights;</li>
          <li>copy, scrape, resell or share books or audio, or try to get around payment, licensing or ad systems;</li>
          <li>attack, probe or overload Ebookvox, or try to get into accounts or systems that are not yours;</li>
          <li>upload malware, or harmful, hateful or abusive material;</li>
          <li>use someone else’s identity or create accounts to cheat, abuse offers or evade a ban.</li>
        </Ul>
      </Section>

      <Section n={9} title="Our service and third parties">
        <p>We work to keep Ebookvox available and accurate, but we do not promise it will always work without interruption or errors. Features, books, voices and prices can change. Ebookvox relies on third-party services such as payment providers, speech providers and sign-in providers, and we are not responsible for their outages or their own terms.</p>
      </Section>

      <Section n={10} title="Ownership of Ebookvox">
        <p>The Ebookvox name, logo, apps, website and software belong to us or our licensors and are protected by law. These terms do not give you any right to them except to use the service as described here.</p>
      </Section>

      <Section n={11} title="Suspension and ending your account">
        <p>You can stop using Ebookvox at any time and ask us to close your account at {mail}. We may suspend or close an account, or remove content, if you break these terms, if the law requires it, or if your account puts others or the service at risk. Sections that by their nature should continue after an account ends, such as ownership, liability and these general terms, will continue.</p>
      </Section>

      <Section n={12} title="Disclaimers and limits on our liability">
        <p>To the fullest extent the law allows, Ebookvox and its content are provided “as is” and “as available”, without promises that go beyond what the law requires. We are not liable for indirect or consequential losses, lost profits or lost data, and our total liability to you for any claim is limited to the amount you paid us in the 12 months before the claim. Nothing in these terms limits liability that cannot be limited by law, and your legal rights as a consumer are not affected.</p>
      </Section>

      <Section n={13} title="Changes to these terms">
        <p>We may update these terms from time to time. We will change the “Last updated” date and, for important changes, tell you in the app or by email. If you keep using Ebookvox after a change takes effect, you accept the new terms.</p>
      </Section>

      <Section n={14} title="Governing law and contact">
        <p>These terms are governed by the laws of {LEGAL.law}, without affecting any mandatory consumer rights you have where you live. If we cannot settle a dispute informally, the courts of {LEGAL.law} will have jurisdiction, again subject to your mandatory local rights.</p>
        <p>Questions about these terms: {mail}. How we handle your personal information is described in our <Link href="/privacy" className="font-medium text-accent hover:underline">Privacy Policy</Link>.</p>
      </Section>
    </LegalPage>
  );
}
