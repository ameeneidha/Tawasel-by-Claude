import PublicPageLayout from '../components/PublicPageLayout';

export default function Changelog() {
  return (
    <PublicPageLayout
      eyebrow="Updates"
      title="Recent product improvements"
      description="This changelog highlights the onboarding, billing, and activation work that has recently improved the first-run WABA Hub experience."
      sections={[
        {
          title: 'Activation and onboarding',
          paragraphs: [
            'New users now move through a clearer setup path instead of landing in a confusing partially-open product state.',
          ],
          bullets: [
            'Added an activation checklist to guide account verification, plan selection, channel connection, and bot creation',
            'Restricted mode messaging was clarified so users know what unlocks after subscription',
            'New workspaces start with no selected plan instead of inheriting Starter by default',
          ],
        },
        {
          title: 'Billing and subscription handling',
          paragraphs: [
            'Stripe checkout and return flows were hardened so the workspace can recover correctly after payment and reflect subscription state more reliably.',
          ],
          bullets: [
            'Added recovery sync when returning from Stripe success pages',
            'Stored subscription renewal timing for billing visibility',
            'Improved package-selection handoff from the marketing site into billing',
          ],
        },
      ]}
    />
  );
}
