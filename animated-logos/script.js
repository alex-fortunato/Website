document.addEventListener("DOMContentLoaded", () => {
    const cacheBuster = "?v=" + new Date().getTime();

    const logoConfigs = {
        github: {
            defaultSvg: "https://alex-fortunato.github.io/Website/animated-logos/assets/github-logo-default.svg" + cacheBuster,
            hoverSvg:   "https://alex-fortunato.github.io/Website/animated-logos/assets/github-logo-hover.svg" + cacheBuster,
            link: "https://github.com/alex-fortunato",
        },
        instagram: {
            defaultSvg: "https://alex-fortunato.github.io/Website/animated-logos/assets/instagram-logo-default.svg" + cacheBuster,
            hoverSvg: "https://alex-fortunato.github.io/Website/animated-logos/assets/instagram-logo-hover.svg" + cacheBuster,
            link: "https://instagram.com/alexfortunato.wav",
        },
        linkedin: {
            defaultSvg: "https://alex-fortunato.github.io/Website/animated-logos/assets/linkedin-logo-default.svg" + cacheBuster,
            hoverSvg: "https://alex-fortunato.github.io/Website/animated-logos/assets/linkedin-logo-hover.svg" + cacheBuster,
            link: "https://linkedin.com/in/alex--fortunato",
        },
        youtube: {
            defaultSvg: "https://alex-fortunato.github.io/Website/animated-logos/assets/youtube-logo-default.svg" + cacheBuster,
            hoverSvg: "https://alex-fortunato.github.io/Website/animated-logos/assets/youtube-logo-hover.svg" + cacheBuster,
            link: "https://www.youtube.com/@alexfortunatomusic1951",
        },
        soundcloud: {
            defaultSvg: "https://alex-fortunato.github.io/Website/animated-logos/assets/soundcloud-logo-default.svg" + cacheBuster,
            hoverSvg: "https://alex-fortunato.github.io/Website/animated-logos/assets/soundcloud-logo-hover.svg" + cacheBuster,
            link: "https://soundcloud.com/alex-fortunato",
        },
    };

    document.querySelectorAll(".alexf-logo-container").forEach((container) => {
        const logoType = container.getAttribute("data-logo");
        const config = logoConfigs[logoType];
        const link = container.closest(".alexf-logo-link");

        if (!config) return;

        container.innerHTML = "";

        const defaultObj = document.createElement("object");
        defaultObj.setAttribute("type", "image/svg+xml");
        defaultObj.setAttribute("data", config.defaultSvg);
        defaultObj.classList.add("alexf-logo-icon", "active");
        defaultObj.id = `${logoType}-icon-default`;

        const hoverObj = document.createElement("object");
        hoverObj.setAttribute("type", "image/svg+xml");
        hoverObj.setAttribute("data", config.hoverSvg);
        hoverObj.classList.add("alexf-logo-icon");
        hoverObj.id = `${logoType}-icon-hover`;

        container.appendChild(defaultObj);
        container.appendChild(hoverObj);

        link.addEventListener("mouseenter", () => {
            defaultObj.classList.remove("active");
            hoverObj.classList.add("active");
        });

        link.addEventListener("mouseleave", () => {
            hoverObj.classList.remove("active");
            defaultObj.classList.add("active");
        });

        //  JavaScript click handler to ensure links open properly
        link.addEventListener("click", (e) => {
            // Prevent default to ensure our custom handling works
            e.preventDefault();

            // Attempt to open in new window using JavaScript
            window.open(config.link, "_blank");

            // Fallback if window.open is blocked
            setTimeout(() => {
                // If we're in an iframe
                if (window !== window.top) {
                    try {
                        // Try to tell the parent window to navigate
                        window.parent.postMessage({
                            type: "openLink",
                            url: config.link
                        }, "*");
                    } catch (err) {
                        console.log("Could not communicate with parent frame");
                    }
                }
            }, 100);
        });
    });
});
