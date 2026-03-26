import { useLocation } from 'react-router-dom';

export function RouteTransition({ children }) {
  const location = useLocation();

  return (
    <div key={location.pathname} className="route-transition">
      {children}
    </div>
  );
}
