document.addEventListener("click", (e) => {
  const btn = e.target.closest(".nav-link");
  if (!btn) return;

  const viewName = btn.dataset.view;

  // Toggle sections
  document.querySelectorAll(".view").forEach(section => {
    const isTarget = section.dataset.view === viewName;
    section.classList.toggle("hidden", !isTarget);
  });

  // Toggle active button
  document.querySelectorAll(".nav-link").forEach(b =>
    b.classList.remove("active")
  );
  btn.classList.add("active");
});
