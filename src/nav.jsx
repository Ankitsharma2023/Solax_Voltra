import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { BackIcon } from './components/Icons.jsx';

// Minimal stack navigator: tabs at the root, sub-pages pushed on top (slide in from the right).
const Nav = createContext(null);
export const useNav = () => useContext(Nav);

export function NavProvider({ children }) {
  const [stack, setStack] = useState([]); // [{ Component, props, key }]
  const push = useCallback((Component, props = {}) => {
    setStack((s) => [...s, { Component, props, key: Date.now() + Math.random() }]);
    history.pushState({ depth: Date.now() }, '');
  }, []);
  const pop = useCallback(() => history.back(), []);

  // Android back button / browser back pops a sub-page.
  useEffect(() => {
    const onPop = () => setStack((s) => s.slice(0, -1));
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  return (
    <Nav.Provider value={{ push, pop, depth: stack.length }}>
      {children}
      {stack.map(({ Component, props, key }, i) => (
        <div key={key} className="subpage" style={{ zIndex: 20 + i }}>
          <Component {...props} />
        </div>
      ))}
    </Nav.Provider>
  );
}

// Standard sub-page chrome: back arrow + title (+ optional right-side actions).
export function Page({ title, subtitle, actions, children }) {
  const { pop } = useNav();
  return (
    <div className="page">
      <header className="page-head">
        <button className="icon-btn" onClick={pop} aria-label="Back"><BackIcon size={26} /></button>
        <div className="page-title"><h1>{title}</h1>{subtitle && <span className="muted">{subtitle}</span>}</div>
        <div className="page-actions">{actions}</div>
      </header>
      <div className="page-body">{children}</div>
    </div>
  );
}
