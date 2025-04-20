document.addEventListener("DOMContentLoaded", () => {
  // Add a cache-busting parameter using timestamp
  const cacheBuster = "?v=" + new Date().getTime();

  // Configuration for your logos
  const logoConfigs = {
    github: {
      defaultSvg: "./assets/github-logo-default.svg" + cacheBuster,
      hoverSvg: "./assets/github-logo-hover.svg" + cacheBuster,
      link: "https://github.com/afort24",
    },
    instagram: {
      defaultSvg: "./assets/instagram-logo-default.svg" + cacheBuster,
      hoverSvg: "./assets/instagram-logo-hover.svg" + cacheBuster,
      link: "https://instagram.com/alexfortunato.wav",
    },
    linkedin: {
      defaultSvg: "./assets/linkedin-logo-default.svg" + cacheBuster,
      hoverSvg: "./assets/linkedin-logo-hover.svg" + cacheBuster,
      link: "https://linkedin.com/in/alex--fortunato",
    },
    youtube: {
      defaultSvg: "./assets/youtube-logo-default.svg" + cacheBuster,
      hoverSvg: "./assets/youtube-logo-hover.svg" + cacheBuster,
      link: "https://youtube.com/@alexfortunatomusic1951?si=-fu_ilkMKKh24px7",
    },
    soundcloud: {
      defaultSvg: "./assets/soundcloud-logo-default.svg" + cacheBuster,
      hoverSvg: "./assets/soundcloud-logo-hover.svg" + cacheBuster,
      link: "https://soundcloud.com/alex-fortunato",
    },
  };

  // Process each logo container
  document.querySelectorAll(".logo-container").forEach((container) => {
    const logoType = container.getAttribute("data-logo");
    const config = logoConfigs[logoType];
    const link = container.closest(".logo-link");

    if (!config) return; // Skip if no config found

    // Clear the container
    container.innerHTML = "";

    // Create objects for both SVGs
    const defaultObj = document.createElement("object");
    defaultObj.setAttribute("type", "image/svg+xml");
    defaultObj.setAttribute("data", config.defaultSvg);
    defaultObj.classList.add("logo-icon", "active");
    defaultObj.id = `${logoType}-icon-default`;

    const hoverObj = document.createElement("object");
    hoverObj.setAttribute("type", "image/svg+xml");
    hoverObj.setAttribute("data", config.hoverSvg);
    hoverObj.classList.add("logo-icon");
    hoverObj.id = `${logoType}-icon-hover`;

    // Add objects to container
    container.appendChild(defaultObj);
    container.appendChild(hoverObj);

    // Toggle active class on hover
    link.addEventListener("mouseenter", () => {
      defaultObj.classList.remove("active");
      hoverObj.classList.add("active");
    });

    link.addEventListener("mouseleave", () => {
      hoverObj.classList.remove("active");
      defaultObj.classList.add("active");
    });
  });
});
