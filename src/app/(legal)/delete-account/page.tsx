import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import { LegalPage, Section, Ul } from "@/components/Legal";

export const metadata: Metadata = { title: "Delete your account — Ebookvox", description: "How to delete your Ebookvox account and what happens to your data.", alternates: { canonical: `${LEGAL.readerUrl}/delete-account` } };

export default function DeleteAccount() {
  const mail = <a href={`mailto:${LEGAL.email}?subject=Delete%20my%20Ebookvox%20account`} className="font-medium text-accent hover:underline">{LEGAL.email}</a>;
  return (
    <LegalPage
      title="Delete your Ebookvox account"
      updated={LEGAL.updated}
      intro="You can delete your Ebookvox account and the personal data connected to it at any time. This page explains how, and what is deleted and what we keep."
    >
      <Section n={1} title="Delete it yourself in the app or on the website">
        <ol className="list-decimal space-y-1.5 pl-6 marker:text-accent">
          <li>Sign in to Ebookvox in the app or at {LEGAL.readerUrl}.</li>
          <li>Open <strong>Profile</strong>.</li>
          <li>Scroll to <strong>Delete account</strong> and choose it.</li>
          <li>Type <strong>DELETE</strong> to confirm, and enter your password if you have one, then confirm.</li>
        </ol>
        <p>Your account is closed straight away and you are signed out on every device. This cannot be undone.</p>
      </Section>

      <Section n={2} title="Can’t sign in? Ask us to delete it">
        <p>Email {mail} from the address you registered with, or from the address on the account, and say that you want your account deleted. We may ask you to confirm it is yours. We will delete your account within 30 days.</p>
      </Section>

      <Section n={3} title="What is deleted">
        <Ul>
          <li>Your name, email address, phone number and profile photo.</li>
          <li>Your sign-in details, including the Google sign-in link, and all of your active sessions.</li>
          <li>Your library, reading progress and settings.</li>
          <li>Documents and text you uploaded for read-aloud.</li>
          <li>Your support messages and photos you attached.</li>
          <li>Your notifications.</li>
        </Ul>
      </Section>

      <Section n={4} title="What we keep, and for how long">
        <p>The law requires us to keep some financial records, such as orders, wallet top-ups and subscription payments, for tax, accounting and fraud-prevention purposes. We keep only the payment record itself (amount, date, currency and reference). It is no longer linked to your name or contact details. Your wallet balance cannot be paid out after the account is deleted, so spend it before you delete the account.</p>
        <p>If you have an active subscription, it stops renewing and any remaining time is lost.</p>
      </Section>

      <Section n={5} title="Publisher accounts">
        <p>If you also publish books through the Ebookvox Publisher site, that is a separate account. To delete it, email {mail} and tell us which account you mean.</p>
      </Section>

      <Section n={6} title="More information">
        <p>See how we handle your information in our <Link href="/privacy" className="font-medium text-accent hover:underline">Privacy Policy</Link>.</p>
      </Section>
    </LegalPage>
  );
}
