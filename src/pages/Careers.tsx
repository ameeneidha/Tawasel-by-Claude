import PublicPageLayout from '../components/PublicPageLayout';

export default function Careers() {
  return (
    <PublicPageLayout
      eyebrow="Careers"
      title="Help build the future of WhatsApp operations"
      description="WABA Hub is evolving from a powerful internal product foundation into a more polished SaaS experience. We care about practical automation, calm UI, and tools that make operators faster."
      sections={[
        {
          title: 'What we value',
          paragraphs: [
            'We care about product clarity, operational reliability, and building software that saves teams time every single day.',
            'The product sits at the intersection of messaging, AI, CRM workflows, and SaaS infrastructure, so we value people who enjoy shaping systems end to end.',
          ],
          bullets: [
            'Strong product instincts and customer empathy',
            'Comfort with frontend polish and backend ownership',
            'A bias toward practical shipping over complexity',
          ],
        },
        {
          title: 'How to get in touch',
          paragraphs: [
            'There is no public job board in this environment yet, but interest and portfolio links can be routed through Quantops while the careers workflow is still being finalized.',
            'If you are exploring partnerships or early opportunities, the company site is the best current place to start the conversation.',
          ],
          bullets: ['Visit Quantops.ae to start a conversation about open roles or collaboration.'],
        },
      ]}
      ctaLabel="Learn more"
      ctaHref="/about"
    />
  );
}
