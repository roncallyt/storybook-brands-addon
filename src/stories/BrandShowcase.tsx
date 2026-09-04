import React from 'react';

import './brand-showcase.css';

export const BrandShowcase = () => (
  <main className="brand-showcase" data-testid="brand-showcase">
    <section className="brand-showcase__panel" aria-labelledby="brand-showcase-heading">
      <header className="brand-showcase__header">
        <div className="brand-showcase__mark" data-testid="brand-mark" aria-hidden="true">
          <span />
          <span />
        </div>
        <span className="brand-showcase__badge" data-testid="brand-badge">
          Brand system
        </span>
      </header>

      <div className="brand-showcase__intro">
        <p className="brand-showcase__eyebrow">One component, distinct identities</p>
        <h1 id="brand-showcase-heading" data-testid="brand-heading">
          Make every brand feel at home.
        </h1>
        <p>
          Switch the toolbar selection to see one semantic component respond to the active brand’s colors, type, shape,
          border, and depth.
        </p>
      </div>

      <article className="brand-showcase__card" data-testid="brand-card">
        <div>
          <p className="brand-showcase__card-label">Shared foundation</p>
          <h2>Designed to adapt</h2>
          <p>Brand tokens reshape the experience while the markup and content stay exactly the same.</p>
        </div>
        <button type="button" data-testid="brand-action">
          Explore the system
          <span aria-hidden="true">→</span>
        </button>
      </article>
    </section>
  </main>
);
