import { memo } from 'react';
import { Link } from 'react-router-dom';

// Small breadcrumb trail rendered above the page title.
// `parents` holds everything above the current page; the current page
// itself is the title, so it is never a link.
const Breadcrumbs = memo(function Breadcrumbs({ parents = [] }) {
  if (!parents.length) return null;
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {parents.map((parent, index) => (
        <span key={parent.to + parent.label}>
          {index > 0 && (
            <span className="crumbs__sep" aria-hidden="true">
              ›{' '}
            </span>
          )}
          <Link className="crumbs__item" to={parent.to}>
            {parent.label}
          </Link>{' '}
        </span>
      ))}
      <span className="crumbs__sep" aria-hidden="true">
        ›
      </span>
    </nav>
  );
});

// Consistent header used by every screen: breadcrumbs, title, optional
// badge/subtitle on the left, primary actions on the right.
const PageHeader = memo(function PageHeader({ parents, title, badge, subtitle, actions }) {
  return (
    <div className="page__header">
      <div className="page__heading">
        <Breadcrumbs parents={parents} />
        <h1 className="page__title">
          {title}
          {badge}
        </h1>
        {subtitle && <p className="page__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page__actions">{actions}</div>}
    </div>
  );
});

export default PageHeader;
