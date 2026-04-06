function getBootstrapData() {
    const bootstrapElement = document.getElementById("dashboardBootstrap");
    if (!bootstrapElement) {
        return null;
    }

    try {
        return JSON.parse(bootstrapElement.textContent);
    } catch (error) {
        console.error("Failed to parse dashboard bootstrap data", error);
        return null;
    }
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function createLineChart(context, labels, values) {
    return new Chart(context, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Tracked actions",
                    data: values,
                    borderColor: "#7dd3fc",
                    backgroundColor: "rgba(125, 211, 252, 0.18)",
                    borderWidth: 3,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: "#f8fafc",
                    pointBorderColor: "#38bdf8",
                    fill: true,
                    tension: 0.35,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
            },
            scales: {
                x: {
                    ticks: {
                        color: "#9fb0c3",
                    },
                    grid: {
                        color: "rgba(159, 176, 195, 0.12)",
                    },
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0,
                        color: "#9fb0c3",
                    },
                    grid: {
                        color: "rgba(159, 176, 195, 0.12)",
                    },
                },
            },
        },
    });
}

function createBarChart(context, labels, values) {
    return new Chart(context, {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    label: "Login frequency",
                    data: values,
                    backgroundColor: [
                        "#22c55e",
                        "#34d399",
                        "#2dd4bf",
                        "#38bdf8",
                        "#818cf8",
                        "#a78bfa",
                        "#f472b6",
                    ],
                    borderRadius: 12,
                    borderSkipped: false,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
            },
            scales: {
                x: {
                    ticks: {
                        color: "#9fb0c3",
                    },
                    grid: {
                        display: false,
                    },
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0,
                        color: "#9fb0c3",
                    },
                    grid: {
                        color: "rgba(159, 176, 195, 0.12)",
                    },
                },
            },
        },
    });
}

function renderRecentActivity(activity) {
    const container = document.getElementById("recentActivityFeed");
    if (!container) {
        return;
    }

    if (!activity.length) {
        container.innerHTML = '<div class="activity-feed-row"><span>No recent data</span><strong>0 actions</strong></div>';
        return;
    }

    container.innerHTML = activity
        .map(
            (item) => `
                <div class="activity-feed-row">
                    <span>${escapeHtml(item.label)}</span>
                    <strong>${escapeHtml(item.value)} actions</strong>
                </div>
            `
        )
        .join("");
}

function renderRecentLogs(logs) {
    const tableBody = document.getElementById("logsTableBody");
    if (!tableBody) {
        return;
    }

    if (!logs.length) {
        tableBody.innerHTML = '<tr><td colspan="3" class="empty-state">No activity has been logged yet.</td></tr>';
        return;
    }

    tableBody.innerHTML = logs
        .map(
            (log) => `
                <tr>
                    <td>${escapeHtml(log.username)}</td>
                    <td><span class="table-pill">${escapeHtml(log.action)}</span></td>
                    <td>${escapeHtml(log.timestamp)}</td>
                </tr>
            `
        )
        .join("");
}

function setLoadingState(isLoading) {
    const liveStatus = document.getElementById("liveStatus");
    const activityLoader = document.getElementById("activityLoader");
    const loginLoader = document.getElementById("loginLoader");

    if (liveStatus) {
        liveStatus.textContent = isLoading ? "Refreshing…" : "Live sync";
        liveStatus.classList.toggle("is-loading", isLoading);
    }

    [activityLoader, loginLoader].forEach((element) => {
        if (element) {
            element.classList.toggle("is-visible", isLoading);
        }
    });
}

function updateDashboard(payload, charts) {
    document.getElementById("stat-total-users").textContent = payload.total_users;
    document.getElementById("stat-total-logins").textContent = payload.total_logins;
    document.getElementById("stat-total-visits").textContent = payload.total_visits;

    document.getElementById("insight-most-active").textContent = payload.insights.most_active_user;
    document.getElementById("insight-most-active-count").textContent =
        `${payload.insights.most_active_count} tracked actions`;
    document.getElementById("insight-peak-login").textContent = payload.insights.peak_login_time;

    renderRecentActivity(payload.recent_activity);
    renderRecentLogs(payload.recent_logs);

    charts.activity.data.labels = payload.charts.activity.labels;
    charts.activity.data.datasets[0].data = payload.charts.activity.values;
    charts.activity.update();

    charts.logins.data.labels = payload.charts.login_frequency.labels;
    charts.logins.data.datasets[0].data = payload.charts.login_frequency.values;
    charts.logins.update();
}

document.addEventListener("DOMContentLoaded", () => {
    const bootstrapData = getBootstrapData();
    const activityContext = document.getElementById("activityChart");
    const loginContext = document.getElementById("loginChart");

    if (!bootstrapData || !activityContext || !loginContext) {
        return;
    }

    const charts = {
        activity: createLineChart(
            activityContext,
            bootstrapData.charts.activity.labels,
            bootstrapData.charts.activity.values
        ),
        logins: createBarChart(
            loginContext,
            bootstrapData.charts.login_frequency.labels,
            bootstrapData.charts.login_frequency.values
        ),
    };

    async function refreshStats() {
        setLoadingState(true);

        try {
            const response = await fetch("/api/stats", {
                headers: { Accept: "application/json" },
            });

            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }

            const payload = await response.json();
            updateDashboard(payload, charts);
        } catch (error) {
            console.error("Failed to refresh dashboard stats", error);
        } finally {
            setLoadingState(false);
        }
    }

    setInterval(refreshStats, 30000);
});
