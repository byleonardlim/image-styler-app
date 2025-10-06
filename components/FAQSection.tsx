import React from 'react';

import { ReactNode } from 'react';

type FAQItem = {
  id: string;
  question: string;
  answer: string | ReactNode;
  isLast?: boolean;
};

const faqData: FAQItem[] = [
  {
    id: 'how-it-works',
    question: 'How Styllio works?',
    answer: 'Styllio uses AI to analyze the content of your photo and apply the selected artistic style while preserving the original composition and details.'
  },
  {
    id: 'image-formats',
    question: 'What image formats do you accept?',
    answer: 'We accept JPG, PNG, and WebP formats. Maximum file size is up to 10MB per image.'
  },
  {
    id: 'processing-time',
    question: 'How long does processing take?',
    answer: 'Processing typically takes up to 2-5 minutes per image, depending on server load and image complexity. Each image ordering comes with a polling URL to check the status of the processing. The processing URL will be available in the order acknowledgement email.'
  },
  {
    id: 'refund-policy',
    question: 'Can I request a refund?',
    answer: (
      <>
        Yes, we offer a 100% satisfaction guarantee. If you're not happy with the results,{' '}
        <a 
          href="mailto:refund@styliio.com" 
          className="text-blue-500 hover:underline"
        >
          contact us
        </a>{' '}
        within 7 days for a full refund.
      </>
    ),
    isLast: true
  }
];

const FAQSection = () => {
  return (
    <section className="max-w-3xl mx-auto space-y-6 pt-12 pb-12">
      <h2 className="text-3xl font-medium text-center font-plex-condensed">
        Frequently Asked Questions
      </h2>
      <div className="space-y-4">
        {faqData.map((faq, index) => (
          <div 
            key={faq.id} 
            className={`pb-4 ${!faq.isLast ? 'border-b' : ''}`}
          >
            <h3 className="text-lg font-medium">{faq.question}</h3>
            <p className="text-muted-foreground mt-2">
              {faq.answer}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default FAQSection;
