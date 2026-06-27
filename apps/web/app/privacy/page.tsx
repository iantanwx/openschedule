import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy — OpenCal",
}

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: June 27, 2025</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">1. Introduction</h2>
          <p className="mt-2">
            OpenCal (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the opencal.xyz website and
            associated services. This Privacy Policy explains how we collect, use, disclose, and
            safeguard your information when you use our service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">2. Information We Collect</h2>
          <p className="mt-2">We collect information you provide directly:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Account information (name, email address)</li>
            <li>Booking details (date, time, service selected)</li>
            <li>Business information (organization name, venue details, address)</li>
            <li>Contact information (phone number, when optionally provided)</li>
          </ul>
          <p className="mt-2">We automatically collect:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Log data (IP address, browser type, pages visited)</li>
            <li>Cookies for authentication and session management</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">3. How We Use Your Information</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>To provide and maintain our scheduling service</li>
            <li>To send booking confirmations, reminders, and notifications</li>
            <li>To sync calendar events when you connect Google Calendar</li>
            <li>To communicate with you about your account or our services</li>
            <li>To detect and prevent fraud or abuse</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">4. Google Calendar Integration</h2>
          <p className="mt-2">
            When you connect your Google Calendar, we request access to create, modify, and delete
            calendar events on your behalf. We only access your calendar to sync booking events. We
            do not read, store, or share any existing calendar data. You can disconnect at any time
            from your Account Settings.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">5. Data Sharing</h2>
          <p className="mt-2">
            We do not sell your personal information. We share data only with:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Service providers who assist in operating our platform (hosting, email delivery)</li>
            <li>The business you are booking with (your name, email, and booking details)</li>
            <li>As required by law or to protect our rights</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">6. Data Security</h2>
          <p className="mt-2">
            We use industry-standard security measures to protect your data, including encryption in
            transit (TLS) and at rest. However, no method of transmission over the internet is 100%
            secure.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">7. Data Retention</h2>
          <p className="mt-2">
            We retain your data for as long as your account is active or as needed to provide
            services. You may request deletion of your account and associated data by contacting us.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">8. Your Rights</h2>
          <p className="mt-2">Depending on your jurisdiction, you may have the right to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Withdraw consent for data processing</li>
            <li>Export your data in a portable format</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">9. Cookies</h2>
          <p className="mt-2">
            We use essential cookies for authentication and session management. We do not use
            advertising or tracking cookies.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">10. Changes to This Policy</h2>
          <p className="mt-2">
            We may update this policy from time to time. We will notify you of significant changes by
            posting the new policy on this page with an updated date.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">11. Contact Us</h2>
          <p className="mt-2">
            If you have questions about this Privacy Policy, please contact us at{" "}
            <a href="mailto:privacy@opencal.xyz" className="text-foreground underline">
              privacy@opencal.xyz
            </a>.
          </p>
        </section>
      </div>
    </div>
  )
}
