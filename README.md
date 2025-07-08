# Image Styler App

This is an image styling application built with Next.js, utilizing Appwrite for backend services, Stripe for payment processing, and Redis for job management.

## Features

*   **Image Upload**: Users can upload images for styling.
*   **Image Styling Jobs**: Images are processed through a job system, likely involving AI or other styling algorithms.
*   **Payment Integration**: Secure payment processing powered by Stripe for premium features or job execution.
*   **Job Status Polling**: Real-time updates on the status of image styling jobs.

## Technologies Used

*   **Next.js**: React framework for building the web application.
*   **Appwrite**: Open-source backend-as-a-service for authentication, database, and functions.
*   **Stripe**: Payment processing for handling transactions.
*   **Redis**: In-memory data store, likely used for job queues or caching.
*   **Tailwind CSS**: Utility-first CSS framework for styling.
*   **Radix UI**: UI components for building accessible and customizable user interfaces.

## Getting Started

To run this project locally, follow these steps:

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd image-styler-app
    ```
2.  **Install dependencies**:
    ```bash
    pnpm install
    ```
3.  **Set up Environment Variables**:
    Create a `.env.local` file in the root directory and add the necessary environment variables. These typically include:
    *   Appwrite project ID and API keys
    *   Stripe publishable and secret keys
    *   Redis connection string
    *   Next.js specific environment variables

    Refer to `.env.local.example` (if available) for a list of required variables.

4.  **Run the development server**:
    ```bash
    pnpm dev
    ```

    Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Project Structure

*   `app/`: Next.js application routes and API endpoints.
*   `components/`: Reusable React components, including UI elements.
*   `hooks/`: Custom React hooks for shared logic.
*   `lib/`: Utility functions and API service integrations (e.g., Appwrite, Stripe).
*   `types/`: TypeScript type definitions.

## Learn More

*   [Next.js Documentation](https://nextjs.org/docs)
*   [Appwrite Documentation](https://appwrite.io/docs)
*   [Stripe Documentation](https://stripe.com/docs)
*   [Redis Documentation](https://redis.io/docs/)