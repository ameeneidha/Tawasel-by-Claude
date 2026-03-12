import PublicPageLayout from '../components/PublicPageLayout';

export default function Terms() {
  return (
    <PublicPageLayout
      eyebrow="Legal"
      title="Terms of Service"
      description="These summary terms explain the baseline rules for using WABA Hub, including account responsibility, subscription behavior, and acceptable use of connected messaging channels."
      sections={[
        {
          title: 'Accounts and workspace responsibility',
          paragraphs: [
            'Each user is responsible for safeguarding their login credentials and for actions taken inside their workspace.',
            'Workspace owners are responsible for the channels, customer data, templates, and automated behavior configured under their account.',
          ],
          bullets: [
            'Use accurate registration and billing information',
            'Do not share access in ways that bypass seat or role limits',
            'Follow WhatsApp, Meta, Stripe, and other connected platform rules',
          ],
        },
        {
          title: 'Subscriptions and billing',
          paragraphs: [
            'Paid plans are activated through Stripe and unlock limits based on the package selected by the workspace.',
            'Recurring billing, renewal timing, and payment status are managed through the subscription records associated with that workspace.',
          ],
          bullets: [
            'A workspace must choose a plan before paid features unlock',
            'Failed or incomplete payments may keep the workspace in restricted mode',
            'Usage limits and entitlements depend on the active package',
          ],
        },
        {
          title: 'Acceptable use',
          paragraphs: [
            'The service may not be used for spam, unlawful activity, abusive messaging, or content that violates the policies of connected providers.',
            'If misuse, billing abuse, or security issues are detected, access may be limited or suspended to protect the platform and other customers.',
          ],
        },
      ]}
    />
  );
}
