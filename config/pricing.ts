// Pricing configuration for the application
export const IMAGE_PRICING = {
  // Price per image when total images are less than or equal to 5
  STANDARD_PRICE: 3.00,
  // Price per image when total images are more than 5
  BULK_PRICE: 2.50,
  // Threshold for bulk pricing
  BULK_THRESHOLD: 5
} as const;
