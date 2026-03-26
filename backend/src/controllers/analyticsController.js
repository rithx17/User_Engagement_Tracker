import { analyticsService } from '../services/analyticsService.js';
import { parseDateRange } from '../utils/date.js';
import { ensureDemoData, seedDemoData } from '../services/demoDataService.js';

export async function getOverview(req, res, next) {
  try {
    await ensureDemoData();
    const { startDate, endDate } = parseDateRange(req.query);
    const data = await analyticsService.getOverview(startDate, endDate);
    return res.json({ startDate, endDate, data });
  } catch (err) {
    return next(err);
  }
}

export async function getUsers(req, res, next) {
  try {
    await ensureDemoData();
    const { startDate, endDate } = parseDateRange(req.query);
    const data = await analyticsService.getUsersAnalytics(startDate, endDate);
    return res.json({ startDate, endDate, data });
  } catch (err) {
    return next(err);
  }
}

export async function getEvents(req, res, next) {
  try {
    await ensureDemoData();
    const { startDate, endDate } = parseDateRange(req.query);
    const recentLimit = Math.min(200, Math.max(10, Number(req.query.recentLimit || 40)));
    const heatmapDays = Math.min(90, Math.max(7, Number(req.query.heatmapDays || 30)));
    const data = await analyticsService.getEventsAnalytics(startDate, endDate, { recentLimit, heatmapDays });
    return res.json({ startDate, endDate, data });
  } catch (err) {
    return next(err);
  }
}

export async function exportEventsCsv(req, res, next) {
  try {
    const { startDate, endDate } = parseDateRange(req.query);
    const csv = await analyticsService.exportCsv(startDate, endDate);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="engagement-report.csv"');
    return res.send(csv);
  } catch (err) {
    return next(err);
  }
}

export async function generateDemoData(req, res, next) {
  try {
    const seeded = await seedDemoData({ force: true });
    return res.json({
      message: 'Demo analytics data generated',
      ...seeded
    });
  } catch (err) {
    return next(err);
  }
}
