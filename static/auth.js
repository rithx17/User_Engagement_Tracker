document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("[data-auth-form]");
    if (!form) {
        return;
    }

    const mode = form.getAttribute("data-auth-form");
    const submitButton = form.querySelector("button[type='submit']");
    const submitText = submitButton ? submitButton.querySelector("span") : null;
    const defaultLabel = submitButton?.getAttribute("data-submit-label") || "Submit";

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const formData = new FormData(form);
        const payload = {
            username: String(formData.get("username") || "").trim(),
            password: String(formData.get("password") || "").trim(),
        };

        if (!payload.username || !payload.password) {
            window.UET.showToast("Please complete all required fields.", "error");
            return;
        }

        if (submitButton) {
            submitButton.disabled = true;
        }
        if (submitText) {
            submitText.textContent = mode === "login" ? "Signing in..." : "Creating...";
        }

        try {
            const endpoint = mode === "login" ? "/api/login" : "/api/register";
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error?.message || "Request failed.");
            }

            if (mode === "login") {
                window.UET.setAuthSession(data.access_token, data.user);
                window.UET.showToast("Login successful.");
                window.location.href = "/dashboard";
                return;
            }

            window.UET.showToast("Registration successful. Please log in.");
            window.location.href = "/login";
        } catch (error) {
            window.UET.showToast(error.message || "Unable to complete request.", "error");
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
            }
            if (submitText) {
                submitText.textContent = defaultLabel;
            }
        }
    });
});
