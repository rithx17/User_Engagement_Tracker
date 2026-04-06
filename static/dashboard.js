document.addEventListener("DOMContentLoaded", () => {
    const bootstrapNode = document.getElementById("dashboardBootstrap");
    if (!bootstrapNode) {
        return;
    }

    const bootstrap = window.UET.safeParse(bootstrapNode.textContent);
    if (!bootstrap) {
        return;
    }

    window.UET.setAuthSession(bootstrap.auth.token, bootstrap.auth.user);

    const state = {
        logPage: 1,
        logPages: 1,
        perPage: 10,
        charts: {},
    };

    const logStartDate = document.getElementById("logStartDate");
    const logEndDate = document.getElementById("logEndDate");
    const logsPaginationLabel = document.getElementById("logsPaginationLabel");
    const logsPrevButton = document.getElementById("logsPrevButton");
    const logsNextButton = document.getElementById("logsNextButton");
    const syncState = document.getElementById("statsSyncState");
    const activityLoader = document.getElementById("activityLoader");
    const loginLoader = document.getElementById("loginLoader");

    function setLoading(isLoading) {
        if (syncState) {
            syncState.textContent = isLoading ? "Refreshing" : "Live sync";
            syncState.classList.toggle("is-loading", isLoading);
        }
        [activityLoader, loginLoader].forEach((node) => {
            if (node) {
                node.classList.toggle("is-visible", isLoading);
            }
        });
    }

    function renderRecentActivity(items) {
        const container = document.getElementById("recentActivityList");
        if (!container) {
            return;
        }

        container.innerHTML = items
            .map(
                (item) => `
                    <div class="activity-feed-row">
                        <span>${window.UET.escapeHtml(item.label)}</span>
                        <strong>${window.UET.escapeHtml(item.value)} actions</strong>
                    </div>
                `
            )
            .join("");
    }

    function renderLogs(items) {
        const tableBody = document.getElementById("logsTableBody");
        if (!tableBody) {
            return;
        }

        if (!items.length) {
            tableBody.innerHTML = '<tr><td colspan="3" class="empty-state">No logs found for the selected filters.</td></tr>';
            return;
        }

        tableBody.innerHTML = items
            .map(
                (log) => `
                    <tr>
                        <td>${window.UET.escapeHtml(log.username)}</td>
                        <td><span class="table-pill">${window.UET.escapeHtml(log.action)}</span></td>
                        <td>${window.UET.escapeHtml(log.timestamp)}</td>
                    </tr>
                `
            )
            .join("");
    }

    function updateStatsView(payload) {
        document.getElementById("statTotalUsers").textContent = payload.total_users;
        document.getElementById("statTotalLogins").textContent = payload.total_logins;
        document.getElementById("statTotalVisits").textContent = payload.total_visits;
        document.getElementById("mostActiveUser").textContent = payload.insights.most_active_user;
        document.getElementById("mostActiveCount").textContent = `${payload.insights.most_active_count} tracked actions`;
        document.getElementById("peakLoginTime").textContent = payload.insights.peak_login_time;

        renderRecentActivity(payload.recent_activity);

        state.charts.activity.data.labels = payload.charts.activity.labels;
        state.charts.activity.data.datasets[0].data = payload.charts.activity.values;
        state.charts.activity.update();

        state.charts.login.data.labels = payload.charts.login_frequency.labels;
        state.charts.login.data.datasets[0].data = payload.charts.login_frequency.values;
        state.charts.login.update();
    }

    function initCharts(stats) {
        const activityContext = document.getElementById("activityChart");
        const loginContext = document.getElementById("loginChart");

        state.charts.activity = new Chart(activityContext, {
            type: "line",
            data: {
                labels: stats.charts.activity.labels,
                datasets: [
                    {
                        label: "Activity",
                        data: stats.charts.activity.values,
                        borderColor: "#38bdf8",
                        backgroundColor: "rgba(56, 189, 248, 0.15)",
                        tension: 0.35,
                        fill: true,
                        borderWidth: 3,
                        pointRadius: 4,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: "#9fb0c3" }, grid: { color: "rgba(159, 176, 195, 0.12)" } },
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0, color: "#9fb0c3" },
                        grid: { color: "rgba(159, 176, 195, 0.12)" },
                    },
                },
            },
        });

        state.charts.login = new Chart(loginContext, {
            type: "bar",
            data: {
                labels: stats.charts.login_frequency.labels,
                datasets: [
                    {
                        label: "Logins",
                        data: stats.charts.login_frequency.values,
                        backgroundColor: ["#22c55e", "#38bdf8", "#818cf8", "#a78bfa", "#f472b6", "#f59e0b", "#14b8a6"],
                        borderRadius: 12,
                        borderSkipped: false,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: "#9fb0c3" }, grid: { display: false } },
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0, color: "#9fb0c3" },
                        grid: { color: "rgba(159, 176, 195, 0.12)" },
                    },
                },
            },
        });
    }

    async function loadStats() {
        setLoading(true);
        try {
            const response = await window.UET.authFetch("/api/stats", {
                headers: { Accept: "application/json" },
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error?.message || "Unable to load stats.");
            }
            updateStatsView(data);
        } catch (error) {
            window.UET.showToast(error.message || "Unable to refresh stats.", "error");
        } finally {
            setLoading(false);
        }
    }

    async function loadLogs(page = 1) {
        const query = new URLSearchParams({
            page: String(page),
            per_page: String(state.perPage),
        });

        if (logStartDate?.value) {
            query.set("start_date", logStartDate.value);
        }
        if (logEndDate?.value) {
            query.set("end_date", logEndDate.value);
        }

        try {
            const response = await window.UET.authFetch(`/api/logs?${query.toString()}`, {
                headers: { Accept: "application/json" },
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error?.message || "Unable to load logs.");
            }

            state.logPage = data.pagination.page;
            state.logPages = data.pagination.pages;
            renderLogs(data.items);
            logsPaginationLabel.textContent = `Page ${state.logPage} of ${state.logPages}`;
            logsPrevButton.disabled = state.logPage <= 1;
            logsNextButton.disabled = state.logPage >= state.logPages;
        } catch (error) {
            window.UET.showToast(error.message || "Unable to refresh logs.", "error");
        }
    }

    initCharts(bootstrap.stats);
    renderLogs(bootstrap.stats.recent_logs);
    logsPaginationLabel.textContent = "Page 1";
    logsPrevButton.disabled = true;
    state.logPages = 1;

    document.getElementById("logFilters").addEventListener("submit", (event) => {
        event.preventDefault();
        loadLogs(1);
    });

    logsPrevButton.addEventListener("click", () => {
        if (state.logPage > 1) {
            loadLogs(state.logPage - 1);
        }
    });

    logsNextButton.addEventListener("click", () => {
        if (state.logPage < state.logPages) {
            loadLogs(state.logPage + 1);
        }
    });

    window.setInterval(loadStats, 30000);
    loadLogs(1);
});
