import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Breadcrumb: React.FC = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  return (
    <nav className="text-sm text-muted-foreground">
      <Link to="/dashboard">Dashboard</Link>
      {pathnames.map((name, index) => {
        const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        // The first path segment is the page title, so we skip it
        if (index === 0) return null;
        return (
          <span key={name}>
            {' / '}
            {isLast ? (
              <span className="text-foreground">{name.charAt(0).toUpperCase() + name.slice(1)}</span>
            ) : (
              <Link to={routeTo}>{name.charAt(0).toUpperCase() + name.slice(1)}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
};

export default Breadcrumb;
