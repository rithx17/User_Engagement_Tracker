(function (global) {
  class EngagementTracker {
    constructor(config = {}) {
      this.endpoint = config.endpoint || 'http://localhost:5000/api/events/track';
      this.flushIntervalMs = config.flushIntervalMs || 5000;
      this.maxQueue = config.maxQueue || 20;
      this.sessionId = sessionStorage.getItem('tracker_session_id') || this.uuid();
      this.userId = config.userId || null;
      this.page = window.location.pathname;
      this.queue = [];
      this.activeMs = 0;
      this.idleMs = 0;
      this.scrollDepth = 0;
      this.isActive = true;
      this.startedAt = Date.now();
      this.lastTick = Date.now();

      sessionStorage.setItem('tracker_session_id', this.sessionId);
      this.start();
    }

    uuid() {
      if (global.crypto && global.crypto.randomUUID) {
        return global.crypto.randomUUID();
      }
      return `sid_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    }

    basePayload() {
      return {
        sessionId: this.sessionId,
        page: this.page,
        activeMs: this.activeMs,
        idleMs: this.idleMs,
        scrollDepth: this.scrollDepth,
        durationMs: Date.now() - this.startedAt,
        metadata: {
          userId: this.userId,
          referrer: document.referrer
        }
      };
    }

    async send(payload) {
      try {
        await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      } catch (_) {
      }
    }

    track(eventType, data = {}) {
      const payload = {
        ...this.basePayload(),
        eventType,
        ...data,
        occurredAt: new Date().toISOString()
      };

      this.queue.push(payload);
      if (this.queue.length >= this.maxQueue) {
        this.flush();
      }
    }

    async flush() {
      const batch = this.queue.splice(0, this.queue.length);
      await Promise.all(batch.map((event) => this.send(event)));
    }

    setupActivity() {
      let idleTimer;
      const markActive = () => {
        this.isActive = true;
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          this.isActive = false;
        }, 30000);
      };

      global.addEventListener('mousemove', markActive);
      global.addEventListener('keydown', markActive);
      markActive();
    }

    setupClicks() {
      global.addEventListener('click', (event) => {
        const target = event.target;
        const label = target?.id || target?.name || target?.innerText?.slice(0, 80) || target?.tagName;
        this.track('button_click', {
          element: label,
          metadata: {
            x: event.clientX,
            y: event.clientY
          }
        });
      });
    }

    setupScroll() {
      global.addEventListener('scroll', () => {
        const current = Math.round(
          ((global.scrollY + global.innerHeight) / document.documentElement.scrollHeight) * 100
        );
        this.scrollDepth = Math.max(this.scrollDepth, Number.isFinite(current) ? current : 0);
      });
    }

    setupTimers() {
      this.clock = global.setInterval(() => {
        const now = Date.now();
        const delta = now - this.lastTick;
        if (this.isActive) {
          this.activeMs += delta;
        } else {
          this.idleMs += delta;
        }
        this.lastTick = now;
      }, 1000);

      this.flusher = global.setInterval(() => {
        this.flush();
      }, this.flushIntervalMs);
    }

    setupLifecycle() {
      this.track('page_visit');
      global.addEventListener('beforeunload', () => {
        this.track('session_end');
      });
    }

    start() {
      this.setupActivity();
      this.setupClicks();
      this.setupScroll();
      this.setupTimers();
      this.setupLifecycle();
    }
  }

  global.tracker = {
    create(config) {
      return new EngagementTracker(config);
    }
  };
})(window);
