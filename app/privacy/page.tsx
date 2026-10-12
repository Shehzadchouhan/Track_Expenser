import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white px-6 py-12 text-zinc-800 dark:bg-black dark:text-zinc-200">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy for Track Expenser</h1>
        <p className="text-sm text-zinc-500">Effective Date: October 2026</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Overview</h2>
          <p className="text-sm leading-relaxed">
            Track Expenser is a personal finance companion that enables users to track daily expenses
            via natural language text and receipts. We prioritize your privacy and handle your data with care.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. Data We Process</h2>
          <p className="text-sm leading-relaxed">
            We only process expense-related information that you voluntarily send to our service, including:
            transaction amounts, merchant names, categories, and payment receipts.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. How We Use Your Data</h2>
          <p className="text-sm leading-relaxed">
            Your data is used solely to calculate your Safe-to-Spend daily budget pulse and display your financial
            dashboard. We do not sell, rent, or share your financial data with third-party advertisers.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Security & Storage</h2>
          <p className="text-sm leading-relaxed">
            All database communications use TLS/HTTPS encryption with Row-Level Security (RLS) enforcement.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Contact</h2>
          <p className="text-sm leading-relaxed">
            For data inquiries or deletion requests, contact support at trackexpenser.local.
          </p>
        </section>
      </div>
    </div>
  );
}
