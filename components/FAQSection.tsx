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
    id: 'what-is-styllio',
    question: 'What is Styllio?',
    answer: 'Styllio is a photo stylization service that uses AI to apply artistic styles to your photos while preserving the original composition and details. All the styles are original and unique to Styllio with careful prompt design to ensure unique and consistent results.'
  },
  {
    id: 'how-it-works',
    question: 'How Styllio works?',
    answer: 'Styllio uses AI to analyze the content of your photo and apply the selected artistic style while preserving the original composition and details.'
  },
  {
    id: 'image-formats',
    question: 'What image formats do you accept?',
    answer: 'We only accept JPG, PNG, and WebP formats. Maximum file size is up to 10MB per image.'
  },
  {
    id: 'processing-time',
    question: 'How long does processing take?',
    answer: 'Processing typically takes up to 2-5 minutes per image, depending on server load and image complexity. Each order comes with a polling URL to check the status of the processing. The polling URL will be available in the order confirmation email.'
  },
  {
    id: 'child-obscene-graphics',
    question: 'Why are there errors to my order?',
    answer: (
      <>
        If you have encountered any errors with your order where images cannot be generated. You may have uploaded images that may contain young child or obscene material that has been rejected by the AI. If you believe that this is a mistake,{' '}
        <a 
          href="mailto:refund@tx.styliio.com" 
          className="text-blue-500 hover:underline"
        >
          contact us
        </a>{' '}
        within 24 hours of your order confirmation for a review and potential refund.
      </>
    ),
  },
  {
    id: 'gibberish-graphics',
    question: 'Why are some of the graphics turned out to be gibberish?',
    answer: 'Gibberish graphics are a result of the AI not being able to understand some parts of the content in the image. This is a common issue with AI and can be avoided by using high quality images with clear composition and details. We are constantly optimizing the prompts to ensure the AI could produce consistent and high-quality results.'
  },
  {
    id: 'refund-policy',
    question: 'Can I request a refund?',
    answer: (
      <>
        Sometimes, the images may not turn out to be perfect. In such cases,{' '}
        <a 
          href="mailto:refund@tx.styliio.com" 
          className="text-blue-500 hover:underline"
        >
          contact us
        </a>{' '}
        within 48 hours of your order confirmation for a full refund.
      </>
    ),
    isLast: true
  }
];

const FAQSection = () => {
  return (
    <section className="max-w-3xl mx-auto space-y-6 pt-12 pb-12">
      <h2 className="text-3xl font-medium text-center font-plex-condensed">
        Questions? Read these.
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
