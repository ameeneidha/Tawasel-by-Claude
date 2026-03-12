import PublicPageLayout from '../components/PublicPageLayout';

export default function About() {
  return (
    <PublicPageLayout
      eyebrow="About"
      title="Built for teams running serious WhatsApp operations"
      description="WABA Hub brings inbox collaboration, CRM structure, AI automation, and subscription controls into one workspace so growing teams can run customer conversations without stitching tools together."
      sections={[
        {
          title: 'What WABA Hub helps teams do',
          paragraphs: [
            'WABA Hub is designed for businesses that depend on WhatsApp to support customers, qualify leads, and manage day-to-day conversations.',
            'Instead of juggling separate tools for inboxes, campaign work, AI responses, and workspace administration, teams can operate from one shared environment.',
          ],
          bullets: [
            'Manage inbound conversations from a team inbox',
            'Organize customers inside a lightweight CRM workflow',
            'Use AI assistants to automate repetitive replies',
            'Control access and billing from a workspace-level SaaS setup',
          ],
        },
        {
          title: 'How the product is structured',
          paragraphs: [
            'The platform is intentionally WhatsApp-first, but it is built to expand into broader customer operations as a team grows.',
            'Users register, verify their account, choose a paid package, and then unlock more advanced capabilities such as automation, CRM workflows, and AI bot tooling.',
          ],
          bullets: [
            'Inbox and billing are available early in the onboarding flow',
            'Paid plans unlock usage limits and deeper operational features',
            'Channels, chatbots, and CRM tools are designed to work together',
          ],
        },
      ]}
    />
  );
}
