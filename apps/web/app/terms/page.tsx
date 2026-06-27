import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of Service — OpenCal",
}

export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: June 27, 2025</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
          <p className="mt-2">
            By accessing or using OpenCal (&quot;the Service&quot;), you agree to be bound by these
            Terms of Service. If you do not agree, do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">2. Description of Service</h2>
          <p className="mt-2">
            OpenCal is an online scheduling platform that enables businesses to manage appointments
            and allows customers to book services. The Service includes a customer-facing booking
            interface and an administrative dashboard.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">3. User Accounts</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>You must provide accurate and complete information when creating an account.</li>
            <li>You are responsible for maintaining the security of your account credentials.</li>
            <li>You must notify us immediately of any unauthorized use of your account.</li>
            <li>You must be at least 18 years old to create a business account.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">4. Acceptable Use</h2>
          <p className="mt-2">You agree not to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Use the Service for any unlawful purpose</li>
            <li>Interfere with or disrupt the Service or its infrastructure</li>
            <li>Attempt to gain unauthorized access to any part of the Service</li>
            <li>Use automated means to access the Service without permission</li>
            <li>Impersonate another person or entity</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">5. Bookings and Cancellations</h2>
          <p className="mt-2">
            OpenCal facilitates bookings between customers and businesses. The business is
            responsible for fulfilling confirmed bookings. Cancellation policies are set by each
            business. OpenCal is not liable for disputes between customers and businesses.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">6. Intellectual Property</h2>
          <p className="mt-2">
            The Service and its original content, features, and functionality are owned by OpenCal
            and are protected by applicable intellectual property laws. You retain ownership of any
            content you submit to the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">7. Limitation of Liability</h2>
          <p className="mt-2">
            To the maximum extent permitted by law, OpenCal shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages, including loss of profits, data,
            or business opportunities arising from your use of the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">8. Disclaimer of Warranties</h2>
          <p className="mt-2">
            The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties
            of any kind, either express or implied, including but not limited to implied warranties of
            merchantability, fitness for a particular purpose, and non-infringement.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">9. Termination</h2>
          <p className="mt-2">
            We may terminate or suspend your account at any time, without prior notice, for conduct
            that we determine violates these Terms or is harmful to other users or the Service. You
            may delete your account at any time by contacting us.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">10. Changes to Terms</h2>
          <p className="mt-2">
            We reserve the right to modify these Terms at any time. We will provide notice of
            significant changes by posting the updated Terms on this page. Your continued use of the
            Service after changes constitutes acceptance of the new Terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">11. Governing Law</h2>
          <p className="mt-2">
            These Terms shall be governed by and construed in accordance with the laws of Singapore,
            without regard to its conflict of law provisions.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">12. Contact Us</h2>
          <p className="mt-2">
            If you have questions about these Terms, please contact us at{" "}
            <a href="mailto:legal@opencal.xyz" className="text-foreground underline">
              legal@opencal.xyz
            </a>.
          </p>
        </section>
      </div>
    </div>
  )
}
