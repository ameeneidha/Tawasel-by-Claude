import PublicPageLayout from '../components/PublicPageLayout';

export default function Privacy() {
  return (
    <PublicPageLayout
      eyebrow="Privacy"
      title="Privacy Policy"
      description="This page explains the categories of data WABA Hub processes, how that data supports the service, and the controls teams should expect when operating inside the platform."
      sections={[
        {
          title: 'Information we process',
          paragraphs: [
            'WABA Hub processes account details, workspace settings, billing metadata, and conversation data that users choose to connect through supported channels.',
            'We also store operational metadata such as plan selections, workspace membership, chatbot configuration, and usage records needed to keep the service running.',
          ],
          bullets: [
            'Account identity data such as name, email, and role',
            'Workspace and billing records needed for subscriptions',
            'Connected channel metadata and conversation content',
            'Usage events required for product security, support, and troubleshooting',
          ],
        },
        {
          title: 'How data is used',
          paragraphs: [
            'Data is used to provide the product, secure access, enforce subscription rules, and help teams manage customer conversations inside the app.',
            'Where AI features are enabled, selected content may be processed through configured third-party model providers to generate summaries or responses.',
          ],
          bullets: [
            'Deliver inbox, CRM, automation, and billing functionality',
            'Protect workspaces from unauthorized access or misuse',
            'Improve reliability, debugging, and support workflows',
            'Generate AI-assisted outputs when those features are explicitly used',
          ],
        },
        {
          title: 'Retention and access',
          paragraphs: [
            'Teams are responsible for the data they connect to the platform and should review their own obligations under local privacy laws and channel-provider policies.',
            'If you need contractual, deletion, or retention details for a production deployment, request them before onboarding live customer data.',
          ],
        },
      ]}
    />
  );
}
