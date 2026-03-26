import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    sessionId: { type: String, required: true, index: true },
    eventType: { type: String, required: true, index: true },
    page: { type: String, default: '/', index: true },
    feature: { type: String, default: null, index: true },
    element: { type: String, default: null, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    scrollDepth: { type: Number, default: 0 },
    activeMs: { type: Number, default: 0 },
    idleMs: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    occurredAt: { type: Date, required: true, index: true },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null }
  },
  { timestamps: true }
);

eventSchema.index({ occurredAt: -1, eventType: 1 });
eventSchema.index({ userId: 1, occurredAt: -1 });
eventSchema.index({ occurredAt: -1, page: 1 });
eventSchema.index({ occurredAt: -1, element: 1 });
eventSchema.index({ sessionId: 1, occurredAt: -1 });
eventSchema.index({ feature: 1, occurredAt: -1 });

export const Event = mongoose.model('Event', eventSchema);
