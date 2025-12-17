document.addEventListener("DOMContentLoaded", () => {
  setupNav();
});

function setupNav() {
  document.querySelectorAll(".nav-link").forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      showView(view);

      document.querySelectorAll(".nav-link")
        .forEach(b => b.classList.remove("active"));

      btn.classList.add("active");
    });
  });
}

function showView(name) {
  document.querySelectorAll("section.view").forEach(section => {
    section.classList.toggle(
      "active",
      section.dataset.view === name
    );
  });
}
