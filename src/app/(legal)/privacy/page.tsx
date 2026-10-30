import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";
import { LegalPage, Section, Ul } from "@/components/Legal";

export const metadata: Metadata = { title: "Privacy Policy — Ebookvox", description: "How Ebookvox collects, uses and protects your personal information.", alternates: { canonical: `${LEGAL.readerUrl}/privacy` } };

export default function Privacy() {
  const mail = <a href={`mailto:${LEGAL.email}`} className="font-medium text-accent hover:underline">{LEGAL.email}</a>;
  return (
    <LegalPage
      title="Privacy Policy"
      updated={LEGAL.updated}
      intro="This policy explains what personal information Ebookvox collects, why we collect it, who we share it with and the choices you have. We have tried to keep it plain and short. If something is unclear, write to us."
    >
      <Section n={1} title="Who we are and what this covers">
        <p>Ebookvox (“we”, “us”) runs the Ebookvox Reader at {LEGAL.readerUrl} and in our iOS and Android apps, the Ebookvox Publisher site at {LEGAL.publisherUrl}, and the website {LEGAL.site}. This policy covers all of them. We decide how and why your personal information is used, which makes us the “controller” of it.</p>
      </Section>

      <Section n={2} title="Information we collect">
        <p><strong>Information you give us</strong></p>
        <Ul>
          <li>Account details: your name, email address, phone number, country and password. We store passwords only in a scrambled (hashed) form, never in plain text.</li>
          <li>Your profile photo, if you add one, and your settings such as voice, speed and theme.</li>
          <li>Text, PDF, DOCX and TXT files you paste or upload so that we can read them aloud.</li>
          <li>Messages and photos you send to our support team.</li>
          <li>If you are a publisher: your publisher name and bio, your books, covers and descriptions, and the payout details you give us so we can pay you.</li>
        </Ul>
        <p><strong>Information created when you use Ebookvox</strong></p>
        <Ul>
          <li>Your library, reading and listening progress, orders, wallet balance and transactions, and subscription history.</li>
          <li>Payment records: amount, currency, date and reference. Card payments are handled by our payment provider, Paystack. We never see or store your full card number.</li>
          <li>Notifications we send you in the app and by email.</li>
        </Ul>
        <p><strong>Technical information</strong></p>
        <Ul>
          <li>Your IP address, browser or device type, and the approximate country we work out from your IP address. We use the country to choose your currency, prices and a default voice.</li>
          <li>Cookies and similar technologies that keep you signed in and remember preferences (see section 6).</li>
        </Ul>
        <p><strong>From other services:</strong> if you choose “Continue with Google”, we receive your name and email address from Google.</p>
      </Section>

      <Section n={3} title="How we use your information">
        <Ul>
          <li>To create and run your account, and to sign you in securely.</li>
          <li>To let you read books and listen to books and documents, and to remember where you stopped.</li>
          <li>To process payments, wallet top-ups, subscriptions and publisher payouts, and to keep financial records.</li>
          <li>To show prices in your currency and choose a sensible default voice for your country.</li>
          <li>To send service emails and notifications, such as email verification, password resets, receipts and replies from support.</li>
          <li>To show advertising to people who have not subscribed, and to measure it.</li>
          <li>To keep Ebookvox secure, prevent fraud and abuse, fix problems and improve the service.</li>
          <li>To follow the law and to enforce our Terms &amp; Conditions.</li>
        </Ul>
        <p>Depending on where you live, our legal reasons for using your information are: to perform our contract with you, our legitimate interests (running and securing the service), your consent (for example for personalised ads, where the law asks for it) and legal obligations.</p>
      </Section>

      <Section n={4} title="Who we share it with">
        <p>We do not sell your personal information. We share it only with the people and companies that help us run Ebookvox, and only as much as they need:</p>
        <Ul>
          <li><strong>Paystack</strong> to take card payments and top-ups.</li>
          <li><strong>Microsoft Azure Speech</strong> to turn text into audio. The text you ask us to read aloud is sent to it to produce the voice.</li>
          <li><strong>Google</strong> (AdSense and AdMob) to show ads to non-subscribers, and for “Sign in with Google”.</li>
          <li>Our hosting, email delivery and security providers.</li>
          <li><strong>Publishers</strong>, who receive only the information needed to report and pay for sales of their books.</li>
          <li>Authorities, courts or professional advisers when the law requires it or to protect our rights and users.</li>
          <li>A buyer or successor if Ebookvox is ever merged or sold. We would tell you and this policy would keep applying.</li>
        </Ul>
      </Section>

      <Section n={5} title="Payments, subscriptions and your wallet">
        <p>Payments for books, subscriptions and wallet top-ups are processed by Paystack on its own secure pages. We receive confirmation that a payment succeeded and its reference, amount and currency. Subscribing removes ads from your account.</p>
      </Section>

      <Section n={6} title="Advertising and cookies">
        <p>People who have not subscribed see advertising. It is provided by Google AdSense on the web and Google AdMob in our mobile apps, and it may use cookies, device or advertising identifiers and similar technologies to show and measure ads. People who subscribe do not see ads.</p>
        <Ul>
          <li>You can manage or turn off personalised ads at <a className="text-accent hover:underline" href="https://adssettings.google.com" rel="noopener noreferrer" target="_blank">adssettings.google.com</a>.</li>
          <li>On iPhone and iPad we ask permission before tracking you across other companies’ apps and websites. On Android you can reset or remove your advertising ID in your device settings.</li>
          <li>We also use essential cookies that keep you signed in and remember your theme and preferences. The site does not work properly without them. You can block cookies in your browser, but you may not be able to sign in.</li>
        </Ul>
      </Section>

      <Section n={7} title="Where your information is processed">
        <p>Ebookvox and some of our providers operate in several countries, so your information may be processed outside the country where you live. When we do this we rely on appropriate safeguards, such as contracts with our providers.</p>
      </Section>

      <Section n={8} title="How long we keep it">
        <p>We keep your account information for as long as your account is open. When you ask us to delete your account we remove or anonymise your personal information, except records we must keep to meet tax, accounting or legal duties, to resolve disputes or to prevent fraud. Support messages are kept for a reasonable period so we can help you.</p>
      </Section>

      <Section n={9} title="How we protect it">
        <p>We use encrypted connections (HTTPS), hashed passwords, signed sessions and limits on who inside Ebookvox can see data. No system is perfectly secure, so please use a strong, unique password and do not share it. If you think your account has been accessed without your permission, tell us right away.</p>
      </Section>

      <Section n={10} title="Your rights and choices">
        <p>Depending on where you live, you may have the right to:</p>
        <Ul>
          <li>see the personal information we hold about you and get a copy;</li>
          <li>correct information that is wrong (you can edit most of it in Profile and Settings);</li>
          <li>ask us to delete your information or close your account;</li>
          <li>object to or restrict some uses, and withdraw consent you gave us;</li>
          <li>complain to your data protection authority, such as the Nigeria Data Protection Commission in Nigeria.</li>
        </Ul>
        <p>To use any of these rights, contact us at {mail}. We may need to confirm it is really you first. You can delete your account yourself from Profile in the app or website; see <a className="font-medium text-accent hover:underline" href="/delete-account">how to delete your account</a>.</p>
      </Section>

      <Section n={11} title="Children">
        <p>Ebookvox is not meant for children under 13, or under the age required by the law of your country. We do not knowingly collect their information. If you think a child has given us personal information, contact us and we will delete it.</p>
      </Section>

      <Section n={12} title="Changes to this policy">
        <p>We may update this policy from time to time. We will change the “Last updated” date at the top, and for important changes we will tell you in the app or by email.</p>
      </Section>

      <Section n={13} title="Contact us">
        <p>Questions or requests about your privacy: {mail}. You can also open a ticket from Support inside the Reader.</p>
      </Section>
    </LegalPage>
  );
}
