document.addEventListener("DOMContentLoaded", () => {
    const bootstrapNode = document.getElementById("usersBootstrap");
    if (!bootstrapNode) {
        return;
    }

    const bootstrap = window.UET.safeParse(bootstrapNode.textContent);
    if (!bootstrap) {
        return;
    }

    window.UET.setAuthSession(bootstrap.auth.token, bootstrap.auth.user);

    const state = {
        page: 1,
        pages: bootstrap.pagination.pages || 1,
        search: "",
        editingUserId: null,
        currentUserId: bootstrap.auth.user.id,
    };

    const form = document.getElementById("userForm");
    const userIdField = document.getElementById("userId");
    const userUsernameField = document.getElementById("userUsername");
    const userPasswordField = document.getElementById("userPassword");
    const userSubmitButton = document.getElementById("userSubmitButton");
    const userCancelButton = document.getElementById("userCancelButton");
    const searchForm = document.getElementById("userSearchForm");
    const searchInput = document.getElementById("userSearchInput");
    const usersPrevButton = document.getElementById("usersPrevButton");
    const usersNextButton = document.getElementById("usersNextButton");
    const usersPaginationLabel = document.getElementById("usersPaginationLabel");
    const usersTablePaginationLabel = document.getElementById("usersTablePaginationLabel");
    const usersPageCount = document.getElementById("usersPageCount");
    const usersTableBody = document.getElementById("usersTableBody");

    function resetForm() {
        state.editingUserId = null;
        userIdField.value = "";
        userUsernameField.value = "";
        userPasswordField.value = "";
        userPasswordField.required = false;
        userSubmitButton.textContent = "Create user";
    }

    function renderUsers(items, pagination) {
        usersPageCount.textContent = items.length;
        usersPaginationLabel.textContent = `Page ${pagination.page} of ${pagination.pages}`;
        usersTablePaginationLabel.textContent = `Page ${pagination.page} of ${pagination.pages}`;
        usersPrevButton.disabled = pagination.page <= 1;
        usersNextButton.disabled = pagination.page >= pagination.pages;

        if (!items.length) {
            usersTableBody.innerHTML = '<tr><td colspan="3" class="empty-state">No users match the current search.</td></tr>';
            return;
        }

        usersTableBody.innerHTML = items
            .map(
                (user) => `
                    <tr>
                        <td>${window.UET.escapeHtml(user.id)}</td>
                        <td>${window.UET.escapeHtml(user.username)}</td>
                        <td class="table-actions">
                            <button class="button button-secondary" type="button" data-edit-user="${window.UET.escapeHtml(user.id)}" data-username="${window.UET.escapeHtml(user.username)}">Edit</button>
                            <button class="button button-secondary" type="button" data-delete-user="${window.UET.escapeHtml(user.id)}" data-username="${window.UET.escapeHtml(user.username)}">Delete</button>
                        </td>
                    </tr>
                `
            )
            .join("");
    }

    async function loadUsers(page = 1) {
        const query = new URLSearchParams({
            page: String(page),
            per_page: "10",
        });

        if (state.search) {
            query.set("search", state.search);
        }

        try {
            const response = await window.UET.authFetch(`/api/users?${query.toString()}`, {
                headers: { Accept: "application/json" },
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error?.message || "Unable to load users.");
            }

            state.page = data.pagination.page;
            state.pages = data.pagination.pages;
            renderUsers(data.items, data.pagination);
        } catch (error) {
            window.UET.showToast(error.message || "Unable to load users.", "error");
        }
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const payload = {
            username: userUsernameField.value.trim(),
            password: userPasswordField.value.trim(),
        };

        if (!payload.username) {
            window.UET.showToast("Username is required.", "error");
            return;
        }

        const isEditing = Boolean(state.editingUserId);
        const endpoint = isEditing ? `/api/users/${state.editingUserId}` : "/api/register";
        const method = isEditing ? "PUT" : "POST";

        if (!isEditing && !payload.password) {
            window.UET.showToast("Password is required for new users.", "error");
            return;
        }

        try {
            const response = await window.UET.authFetch(endpoint, {
                method,
                headers: { Accept: "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error?.message || "Unable to save user.");
            }

            window.UET.showToast(isEditing ? "User updated successfully." : "User created successfully.");
            resetForm();
            loadUsers(state.page);
        } catch (error) {
            window.UET.showToast(error.message || "Unable to save user.", "error");
        }
    });

    userCancelButton.addEventListener("click", resetForm);

    searchForm.addEventListener("submit", (event) => {
        event.preventDefault();
        state.search = searchInput.value.trim();
        loadUsers(1);
    });

    usersPrevButton.addEventListener("click", () => {
        if (state.page > 1) {
            loadUsers(state.page - 1);
        }
    });

    usersNextButton.addEventListener("click", () => {
        if (state.page < state.pages) {
            loadUsers(state.page + 1);
        }
    });

    usersTableBody.addEventListener("click", async (event) => {
        const editButton = event.target.closest("[data-edit-user]");
        if (editButton) {
            state.editingUserId = editButton.getAttribute("data-edit-user");
            userIdField.value = state.editingUserId;
            userUsernameField.value = editButton.getAttribute("data-username");
            userPasswordField.value = "";
            userPasswordField.required = false;
            userSubmitButton.textContent = "Update user";
            return;
        }

        const deleteButton = event.target.closest("[data-delete-user]");
        if (!deleteButton) {
            return;
        }

        const userId = deleteButton.getAttribute("data-delete-user");
        const username = deleteButton.getAttribute("data-username");
        const confirmed = window.confirm(`Delete user "${username}"?`);
        if (!confirmed) {
            return;
        }

        try {
            const response = await window.UET.authFetch(`/api/users/${userId}`, {
                method: "DELETE",
                headers: { Accept: "application/json" },
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error?.message || "Unable to delete user.");
            }

            window.UET.showToast("User deleted successfully.");
            if (data.deleted_self) {
                await window.UET.logoutAndRedirect();
                return;
            }
            resetForm();
            loadUsers(state.page);
        } catch (error) {
            window.UET.showToast(error.message || "Unable to delete user.", "error");
        }
    });

    renderUsers(bootstrap.users, bootstrap.pagination);
});
