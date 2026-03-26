import { useEffect } from 'react';
import { eventService } from '../services/eventService';

function getSessionId() {
  let sessionId = sessionStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('sessionId', sessionId);
  }
  return sessionId;
}

export function useTracker(user) {
  useEffect(() => {
    const sessionId = getSessionId();
    const page = window.location.pathname;
    let activeMs = 0;
    let idleMs = 0;
    let scrollDepth = 0;
    let isActive = true;
    let lastTick = Date.now();
    let sessionStart = Date.now();
    let hasClosedSession = false;

    const base = {
      sessionId,
      page
    };

    const send = (eventType, extra = {}) => {
      eventService.track({
        ...base,
        eventType,
        activeMs,
        idleMs,
        scrollDepth,
        durationMs: Date.now() - sessionStart,
        metadata: {
          referrer: document.referrer,
          userId: user?.id || null,
          ...(extra.metadata || {})
        },
        ...extra
      }).catch(() => {});
    };

    const pageVisitDedupKey = `tracker:${sessionId}:${page}`;
    const lastVisitTs = Number(sessionStorage.getItem(pageVisitDedupKey) || 0);
    if (Date.now() - lastVisitTs > 1000) {
      sessionStorage.setItem(pageVisitDedupKey, String(Date.now()));
      send('page_visit');
    }

    const ticker = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTick;
      if (isActive) {
        activeMs += delta;
      } else {
        idleMs += delta;
      }
      lastTick = now;
    }, 1000);

    let idleTimer;
    const activate = () => {
      isActive = true;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        isActive = false;
      }, 30000);
    };

    const onClick = (event) => {
      const target = event.target;
      const element = target?.id || target?.name || target?.innerText?.slice(0, 80) || target?.tagName;
      send('click_event', { element });
    };

    const onScroll = () => {
      const current = Math.round(
        ((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100
      );
      scrollDepth = Math.max(scrollDepth, Number.isFinite(current) ? current : 0);
    };

    const flushClosingEvent = (eventType) => {
      if (hasClosedSession) {
        return;
      }

      hasClosedSession = true;
      const payload = JSON.stringify({
        ...base,
        eventType,
        activeMs,
        idleMs,
        scrollDepth,
        durationMs: Date.now() - sessionStart,
        metadata: {
          referrer: document.referrer,
          userId: user?.id || null
        },
        occurredAt: new Date().toISOString()
      });

      if (window.navigator.sendBeacon) {
        window.navigator.sendBeacon(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/events/track`,
          new window.Blob([payload], { type: 'application/json' })
        );
        return;
      }

      send(eventType);
    };

    const onUnload = () => {
      flushClosingEvent('session_end');
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushClosingEvent('page_leave');
      }
    };

    window.addEventListener('mousemove', activate);
    window.addEventListener('keydown', activate);
    window.addEventListener('click', onClick);
    window.addEventListener('scroll', onScroll);
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('visibilitychange', onVisibilityChange);

    activate();

    return () => {
      clearInterval(ticker);
      clearTimeout(idleTimer);
      window.removeEventListener('mousemove', activate);
      window.removeEventListener('keydown', activate);
      window.removeEventListener('click', onClick);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (!hasClosedSession) {
        send('page_leave');
      }
    };
  }, [user?.id]);
}
