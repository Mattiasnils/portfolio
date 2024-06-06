// Handle parallax scroll behavior
function parallaxScroll() {
  const scrollPosition = Math.floor(window.scrollY);
  const headline = document.querySelector(".headline");
  const intro = document.getElementById("introduction");
  const background = document.getElementById("hero-bubbles");

  if (headline) {
    const newScale = Math.fround(1 - scrollPosition / 8480);
    headline.style.setProperty("scale", newScale);
    headline.style.transform = `translateY(${Math.fround(
      scrollPosition * 0.6
    )}px)`;
    if (intro) {
      intro.style.transform = `translateY(${Math.fround(
        1 - scrollPosition / 10
      )}px)`;
    }
    if (background) {
      const newScale2 = Math.fround(1 - scrollPosition / 3500);
      background.style.setProperty("scale", newScale2);
    }
  }
}

let rafPending = false;

function scrollHandler() {
  if (!rafPending) {
    window.requestAnimationFrame(function () {
      parallaxScroll();
      rafPending = false;
    });
    rafPending = true;
  }
}

window.addEventListener("scroll", scrollHandler, { passive: true });

// Animate bubbles
const image = document.getElementById("hero-bubbles");
const initialY = parseFloat(getComputedStyle(image).top);
const amplitude = 10;
const frequency = 0.05;
let currentTime = 0;

setInterval(function () {
  const displacement = amplitude * Math.sin(frequency * currentTime);
  const newY = initialY + displacement;
  image.style.top = `${newY}px`;
  currentTime += 1;
}, 32);

// Work card description coloring
const workCards = document.querySelectorAll(".work-card");

workCards.forEach((card) => {
  const image = card.querySelector("img");
  const description = card.querySelector(".work-card-description");

  // Create a new Image object and set its source to the image source
  const imageObj = new Image();
  imageObj.src = image.src;

  // When the image is loaded, perform the following actions
  imageObj.onload = function () {
    // Create a new canvas element and get its 2D context
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    // Set the canvas dimensions
    canvas.width = imageObj.width;
    canvas.height = imageObj.height;

    // Draw the image onto the canvas
    context.drawImage(imageObj, 0, 0, canvas.width, canvas.height);

    // Get the image data from the bottom half of the canvas
    const imageData = context.getImageData(
      0,
      canvas.height / 2,
      canvas.width,
      canvas.height / 2
    ).data;

    // Calculate the average RGB values of the bottom half of the image
    let totalR = 0,
      totalG = 0,
      totalB = 0;
    for (let i = 0; i < imageData.length; i += 4) {
      totalR += imageData[i];
      totalG += imageData[i + 1];
      totalB += imageData[i + 2];
    }
    const avgR = Math.round(totalR / (imageData.length / 4));
    const avgG = Math.round(totalG / (imageData.length / 4));
    const avgB = Math.round(totalB / (imageData.length / 4));

    // Apply the average color as the background color of the work card
    description.style.background = `rgba(${avgR}, ${avgG}, ${avgB}, 0.8)`;

    // Calculate and set the contrast color for the text
    const luminance = (0.299 * avgR + 0.587 * avgG + 0.114 * avgB) / 255;
    const textColor = luminance > 0.5 ? "#000" : "#fff";
    description.style.color = textColor;
  };
});

// Handle the "See More"
document.addEventListener("DOMContentLoaded", function () {
  const viewMoreBtn = document.getElementById("show-more-button");
  const hiddenPosts = document.querySelectorAll(".collapsed");

  viewMoreBtn.addEventListener("click", function () {
    this.blur();
    // Change button text based on visibility
    if (viewMoreBtn.innerText === "Show more") {
      viewMoreBtn.innerHTML =
        '<img src="public/icons/chevronUp-icon.svg" alt="" />Show less';
    } else {
      viewMoreBtn.innerHTML =
        '<img src="public/icons/chevronDown-icon.svg" alt="" />Show more';
    }
    hiddenPosts.forEach((post) => {
      post.classList.toggle("collapsed");
    });
  });
});

// Hover over blog-post
const blogPostLinks = document.querySelectorAll(".blog-post");

// Add event listener to each blog post link
blogPostLinks.forEach((blogPost) => {
  // Add event listener for hover
  blogPost.addEventListener("mouseenter", () => {
    const chevron = blogPost.querySelector(".chevron");
    chevron.style.display = "block";
  });

  // Add event listener for focus
  blogPost.addEventListener("focus", () => {
    const chevron = blogPost.querySelector(".chevron");
    chevron.style.display = "block";
  });

  // Add event listener for mouseout (to hide chevron when not hovered)
  blogPost.addEventListener("mouseleave", () => {
    const chevron = blogPost.querySelector(".chevron");
    chevron.style.display = "none";
  });

  // Add event listener for blur (to hide chevron when not focused)
  blogPost.addEventListener("blur", () => {
    const chevron = blogPost.querySelector(".chevron");
    chevron.style.display = "none";
  });
});
